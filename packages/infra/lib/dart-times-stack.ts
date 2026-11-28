import { fileURLToPath } from 'node:url';
import { Annotations, CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { CfnBudget } from 'aws-cdk-lib/aws-budgets';
import { ComparisonOperator, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
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
import { BlockPublicAccess, Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { InvocationType, Trigger } from 'aws-cdk-lib/triggers';
import type { Construct } from 'constructs';

const repoPath = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url));

export interface DartTimesStackProps extends StackProps {
  /** The Alexa skill ID, once the skill exists. Restricts who can invoke the skill Lambda. */
  alexaSkillId?: string;
  /** Custom domain (apex; www is added too) with a Route 53 hosted zone. Without it the site uses the CloudFront URL. */
  domain?: { name: string; certificate: ICertificate };
  /**
   * The owner's email: AWS Budgets alerts and help-page feedback go here. Without it there's no budget, and
   * feedback is stored but not emailed. AWS sends a one-off "confirm subscription" email for the feedback topic.
   */
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

    // Questions and feedback from the help page. Messages expire after a year (TTL on expiresAt).
    const feedback = new Table(this, 'Feedback', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: RemovalPolicy.RETAIN,
    });
    // Each message is emailed to the owner through this topic.
    const feedbackTopic = new Topic(this, 'FeedbackTopic', { displayName: 'Next Train? feedback' });
    if (props.budgetEmail) feedbackTopic.addSubscription(new EmailSubscription(props.budgetEmail));

    const apiFn = new NodejsFunction(this, 'ApiFunction', {
      ...lambdaDefaults,
      entry: repoPath('packages/api/src/index.ts'),
      logGroup: new LogGroup(this, 'ApiLogs', { retention: RetentionDays.ONE_MONTH }),
      timeout: Duration.seconds(10),
      environment: {
        ...lambdaDefaults.environment,
        FEEDBACK_TABLE: feedback.tableName,
        FEEDBACK_TOPIC_ARN: feedbackTopic.topicArn,
      },
    });
    favourites.grantReadWriteData(apiFn);
    feedback.grantReadWriteData(apiFn);
    feedbackTopic.grantPublish(apiFn);

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
    // One address for search engines: www.<domain> answers with a permanent redirect to <domain>, path and query kept.
    const wwwRedirect =
      props.domain &&
      new cloudfront.Function(this, 'WwwRedirect', {
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        comment: `www.${props.domain.name} → ${props.domain.name}`,
        code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value;
  if (host !== 'www.${props.domain.name}') return request;
  var query = Object.keys(request.querystring).map(function (key) {
    var param = request.querystring[key];
    return param.value === '' ? key : key + '=' + param.value;
  }).join('&');
  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: { location: { value: 'https://${props.domain.name}' + request.uri + (query ? '?' + query : '') } },
  };
}`),
      });
    const distribution = new cloudfront.Distribution(this, 'Site', {
      defaultRootObject: 'index.html',
      domainNames,
      certificate: props.domain?.certificate,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: wwwRedirect
          ? [{ function: wwwRedirect, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }]
          : undefined,
      },
      additionalBehaviors: {
        '/api/stations/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: departuresCache,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        // Live train positions for the map (`/api/trains?service=`): shared by everyone, cached like departures.
        // `/api/trains/*` below doesn't match the bare path, so it needs its own behaviour.
        '/api/trains': {
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
        // The Luas lines' status (`/api/luas/status`, the map's news ticker): the same for everyone.
        '/api/luas/*': {
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

    // ---------- Timetable (GTFS) ----------
    // Built once a day rather than on request: a small job downloads Irish Rail's GTFS timetable (about 10 MB, from
    // the NTA), builds yesterday's, today's and tomorrow's departures and writes one small JSON file per station per
    // day into the site bucket (timetable/<date>/<code>.json). CloudFront serves them like any other file, so the
    // API isn't involved. See docs/decisions.md.
    // Files the job reads but the website must never serve: NI Railways' timetable, which the owner uploads
    // (OpenDataNI refuses scripted downloads). Not behind CloudFront.
    const sourcesBucket = new Bucket(this, 'TimetableSources', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    // The owner's alerts (job failures, and the NIR timetable running out), when there's an email to send them to.
    const alerts = props.budgetEmail ? new Topic(this, 'AlertsTopic', { displayName: 'Next Train? alerts' }) : undefined;
    if (alerts && props.budgetEmail) alerts.addSubscription(new EmailSubscription(props.budgetEmail));

    const timetableFn = new NodejsFunction(this, 'TimetableFunction', {
      ...lambdaDefaults,
      entry: repoPath('packages/api/src/timetableJob.ts'),
      logGroup: new LogGroup(this, 'TimetableLogs', { retention: RetentionDays.ONE_MONTH }),
      // Parsing the timetables peaks at about 300 MB; more memory also means more CPU.
      memorySize: 1024,
      timeout: Duration.minutes(2),
      environment: {
        SITE_BUCKET: siteBucket.bucketName,
        TIMETABLE_SOURCES_BUCKET: sourcesBucket.bucketName,
        ...(alerts ? { ALERTS_TOPIC_ARN: alerts.topicArn } : {}),
      },
    });
    siteBucket.grantPut(timetableFn, 'timetable/*');
    sourcesBucket.grantRead(timetableFn, 'nir/*');
    alerts?.grantPublish(timetableFn);
    // A new NIR release is in use a minute after it's uploaded, not the next night.
    sourcesBucket.addEventNotification(EventType.OBJECT_CREATED, new LambdaDestination(timetableFn), { prefix: 'nir/' });
    // Every night at 03:30 UTC (03:30 in winter, 04:30 in summer, Irish time): after the NTA's nightly rebuild.
    new Rule(this, 'TimetableSchedule', {
      description: 'Build the next days\' timetable files from Irish Rail GTFS',
      schedule: Schedule.cron({ minute: '30', hour: '3' }),
      targets: [new LambdaFunction(timetableFn, { retryAttempts: 2 })],
    });
    // And once after every deploy, so a fresh stack has timetables straight away. Asynchronous, so a slow or
    // failing NTA download can't fail the deploy (the alarm below reports it instead).
    new Trigger(this, 'TimetableAfterDeploy', {
      handler: timetableFn,
      invocationType: InvocationType.EVENT,
      executeAfter: [siteDeployment],
      executeOnHandlerChange: true,
    });
    // Old days aren't needed: yesterday's file only matters for trains still running after midnight.
    siteBucket.addLifecycleRule({ prefix: 'timetable/', expiration: Duration.days(3) });

    // Tell the owner if the job fails (the app keeps showing live times; the timetable just goes stale).
    if (alerts) {
      timetableFn
        .metricErrors({ period: Duration.hours(6) })
        .createAlarm(this, 'TimetableJobFailed', {
          alarmDescription: 'The daily timetable job failed (Irish Rail GTFS download or build). Check its logs.',
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        })
        .addAlarmAction(new SnsAction(alerts));
      // And if it stops running at all (the schedule disabled or deleted): no errors then, so the alarm above
      // stays quiet. It runs at least once every day, so a day with no runs is out of date.
      timetableFn
        .metricInvocations({ period: Duration.days(1) })
        .createAlarm(this, 'TimetableJobDidNotRun', {
          alarmDescription: "The daily timetable job hasn't run for a day, so the app's timetable is out of date. Check the TimetableSchedule rule.",
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
          treatMissingData: TreatMissingData.BREACHING,
        })
        .addAlarmAction(new SnsAction(alerts));
    }

    new CfnOutput(this, 'SiteUrl', {
      value: props.domain ? `https://${props.domain.name}` : `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'AlexaFunctionArn', { value: alexaFn.functionArn });
    // Where `npm run nir:upload` puts each NI Railways timetable release.
    new CfnOutput(this, 'TimetableSourcesBucket', { value: sourcesBucket.bucketName });
  }
}
