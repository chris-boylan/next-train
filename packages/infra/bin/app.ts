import { App } from 'aws-cdk-lib';
import { DartTimesStack } from '../lib/dart-times-stack';

const app = new App();

new DartTimesStack(app, 'DartTimes', {
  // Alexa's EU endpoint calls Lambdas in eu-west-1.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'eu-west-1' },
  alexaSkillId: app.node.tryGetContext('alexaSkillId') || undefined,
});
