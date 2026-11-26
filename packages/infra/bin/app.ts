import { App } from 'aws-cdk-lib';
import { CertStack } from '../lib/cert-stack';
import { DartTimesStack } from '../lib/dart-times-stack';
import { GitHubDeployStack } from '../lib/github-deploy-stack';

const app = new App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const context = (key: string): string | undefined => app.node.tryGetContext(key) || undefined;

// Optional: -c domainName=example.ie (needs a Route 53 hosted zone for it) and -c budgetEmail=you@example.com.
const domainName = context('domainName');
const cert = domainName
  ? new CertStack(app, 'DartTimesCert', { env: { account, region: 'us-east-1' }, crossRegionReferences: true, domainName })
  : undefined;

new DartTimesStack(app, 'DartTimes', {
  // Alexa's EU endpoint calls Lambdas in eu-west-1.
  env: { account, region: 'eu-west-1' },
  crossRegionReferences: Boolean(cert),
  alexaSkillId: context('alexaSkillId'),
  domain: domainName && cert ? { name: domainName, certificate: cert.certificate } : undefined,
  budgetEmail: context('budgetEmail'),
});

// The GitHub Actions deploy role. Not matched by `DartTimes*`, so the pipeline never deploys (or changes) it.
new GitHubDeployStack(app, 'NextTrainGitHubDeploy', {
  env: { account, region: 'eu-west-1' },
  repo: context('githubRepo') ?? 'chris-boylan/next-train',
  environment: 'production',
});
