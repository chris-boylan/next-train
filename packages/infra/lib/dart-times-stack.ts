import { fileURLToPath } from 'node:url';
import { Annotations, CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { FunctionUrlOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { CloudFrontTarget } from 'aws-cdk-lib/aws-route53-targets';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url));

export interface DartTimesStackProps extends StackProps {
  /** The Alexa skill ID, once the skill exists. Restricts who can invoke the skill Lambda. */
  alexaSkillId?: string;
  /** Custom domain (apex; www is added too) with a Route 53 hosted zone. Without it the site uses the CloudFront URL. */
  domain?: { name: string; certificate: ICertificate };
  /** Where to email AWS Budgets alerts. No budget is created without it. */
  budgetEmail?: string;
}

export class DartTimesStack extends Stack {
  constructor(scope: Construct, id: string, props: DartTimesStackProps = {}) {
    super(scope, id, props);

    // Favourites for both apps; user IDs are prefixed `web:` or `alexa:`.
    const favourites = new Table(this, 'Favourites', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'stationCode', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const lambdaDefaults: NodejsFunctionProps = {
      runtime: Runtime.NODEJS_22_X,
      memorySize: 256,
      projectRoot: repoPath(''),
      depsLockFilePath: repoPath('package-lock.json'),
      environment: { FAVOURITES_TABLE: favourites.tableName },
      bundling: { minify: true, sourceMap: true },
    };

    const apiFn = new NodejsFunction(this, 'ApiFunction', {
      ...lambdaDefaults,
      entry: repoPath('packages/api/src/index.ts'),
      logGroup: new LogGroup(this, 'ApiLogs', { retention: RetentionDays.ONE_MONTH }),
      timeout: Duration.seconds(10),
    });
    favourites.grantReadWriteData(apiFn);

    // CloudFront calls the Lambda directly through a Function URL (no API Gateway, so no per-request charge).
    // AWS_IAM + origin access control means only this distribution can invoke it.
    const apiUrl = apiFn.addFunctionUrl({ authType: FunctionUrlAuthType.AWS_IAM });

    // Alexa expects an answer within 8 seconds.
    const alexaFn = new NodejsFunction(this, 'AlexaFunction', {
      ...lambdaDefaults,
      entry: repoPath('packages/alexa/src/index.ts'),
      logGroup: new LogGroup(this, 'AlexaLogs', { retention: RetentionDays.ONE_MONTH }),
      timeout: Duration.seconds(7),
      environment: { ...lambdaDefaults.environment, ALEXA_SKILL_ID: props.alexaSkillId ?? '' },
    });
    favourites.grantReadWriteData(alexaFn);
    alexaFn.addPermission('AlexaSkillInvoke', {
      principal: new ServicePrincipal('alexa-appkit.amazon.com'),
      action: 'lambda:InvokeFunction',
      eventSourceToken: props.alexaSkillId,
    });
    if (!props.alexaSkillId) {
      Annotations.of(alexaFn).addWarningV2(
        'dart-times:alexa-skill-id',
        'No alexaSkillId set: any Alexa skill can invoke this function. Redeploy with -c alexaSkillId=amzn1.ask.skill.... once the skill exists.',
      );
    }

    // Static site and API behind one CloudFront domain, so the browser never makes a cross-origin call.
    const siteBucket = new Bucket(this, 'SiteBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const apiOrigin = FunctionUrlOrigin.withOriginAccessControl(apiUrl);
    // Departures are the same for everyone, so the edge serves repeats for up to 20 s (the handler sends max-age=20):
    // a busy station costs one Lambda call per 20 s rather than one per viewer.
    const departuresCache = new cloudfront.CachePolicy(this, 'DeparturesCache', {
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(20),
      maxTtl: Duration.seconds(30),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });
    const domainNames = props.domain ? [props.domain.name, `www.${props.domain.name}`] : undefined;
    const distribution = new cloudfront.Distribution(this, 'Site', {
      defaultRootObject: 'index.html',
      domainNames,
      certificate: props.domain?.certificate,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/stations/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: departuresCache,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // A train's journey (the station page's look-ahead) is the same for everyone too.
        '/api/trains/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: departuresCache,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // Favourites are per device (x-device-id), so never cached.
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // Hashed build assets never change; everything else (index.html, the service worker, manifest, icons) must be
    // revalidated so a deploy reaches installed PWAs. Neither deployment prunes, so they don't delete each other's
    // files; old hashed assets linger, which also keeps them available to clients still on the previous version.
    const dist = repoPath('packages/web/dist');
    const assetsDeployment = new BucketDeployment(this, 'DeployAssets', {
      sources: [Source.asset(dist, { exclude: ['*', '!assets', '!assets/**'] })],
      destinationBucket: siteBucket,
      prune: false,
      cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
    });
    const siteDeployment = new BucketDeployment(this, 'DeploySite', {
      sources: [Source.asset(dist, { exclude: ['assets', 'assets/**'] })],
      destinationBucket: siteBucket,
      prune: false,
      cacheControl: [CacheControl.noCache()],
      distribution,
      distributionPaths: ['/*'],
    });
    // Upload the assets first so a new index.html never points at files that aren't there yet.
    siteDeployment.node.addDependency(assetsDeployment);

    if (props.domain) {
      const zone = HostedZone.fromLookup(this, 'Zone', { domainName: props.domain.name });
      const target = RecordTarget.fromAlias(new CloudFrontTarget(distribution));
      for (const [id, recordName] of [['Apex', undefined], ['Www', 'www']] as const) {
        new ARecord(this, `${id}A`, { zone, recordName, target });
        new AaaaRecord(this, `${id}Aaaa`, { zone, recordName, target });
      }
    }

    if (props.budgetEmail) {
      const subscribers = [{ subscriptionType: 'EMAIL', address: props.budgetEmail }];
      new CfnBudget(this, 'MonthlyBudget', {
        budget: {
          budgetName: 'next-train-monthly',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: 5, unit: 'USD' },
        },
        notificationsWithSubscribers: [
          { notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80 }, subscribers },
          { notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100 }, subscribers },
        ],
      });
    }

    new CfnOutput(this, 'SiteUrl', {
      value: props.domain ? `https://${props.domain.name}` : `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'AlexaFunctionArn', { value: alexaFn.functionArn });
  }
}
