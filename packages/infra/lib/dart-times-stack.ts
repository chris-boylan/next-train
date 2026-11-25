import { fileURLToPath } from 'node:url';
import { Annotations, CfnOutput, Duration, Fn, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { HttpApi, HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, type NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url));

export interface DartTimesStackProps extends StackProps {
  /** The Alexa skill ID, once the skill exists. Restricts who can invoke the skill Lambda. */
  alexaSkillId?: string;
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

    const httpApi = new HttpApi(this, 'HttpApi');
    httpApi.addRoutes({
      path: '/api/{proxy+}',
      methods: [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('ApiIntegration', apiFn),
    });

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

    const apiDomain = Fn.select(2, Fn.split('/', httpApi.apiEndpoint));
    const distribution = new cloudfront.Distribution(this, 'Site', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(apiDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    new BucketDeployment(this, 'DeploySite', {
      sources: [Source.asset(repoPath('packages/web/dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'AlexaFunctionArn', { value: alexaFn.functionArn });
  }
}
