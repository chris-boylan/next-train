import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import { Effect, OidcProviderNative, PolicyStatement, Role, WebIdentityPrincipal } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface GitHubDeployStackProps extends StackProps {
  /** `owner/name` of the GitHub repo allowed to deploy. */
  repo: string;
  /** The GitHub Actions environment the deploy job runs in (where the approval gate lives). */
  environment: string;
}

/**
 * Lets GitHub Actions deploy without stored AWS keys: the workflow swaps a token GitHub signs for short-lived
 * credentials for this role. Only jobs in `repo` running in `environment` can assume it, and all it can do is
 * assume CDK's bootstrap roles, the same way `cdk deploy` does from a laptop.
 *
 * Deployed once by hand (`npm run deploy:github -w @dart-times/infra`), never by the pipeline itself.
 */
export class GitHubDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: GitHubDeployStackProps) {
    super(scope, id, props);

    const provider = new OidcProviderNative(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const role = new Role(this, 'DeployRole', {
      roleName: 'next-train-github-deploy',
      description: `GitHub Actions deploys for ${props.repo} (${props.environment} environment)`,
      assumedBy: new WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${props.repo}:environment:${props.environment}`,
        },
      }),
    });

    // CDK's bootstrap roles (deploy, file and image publishing, lookups) in any region of this account.
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [`arn:${this.partition}:iam::${this.account}:role/cdk-hnb659fds-*-role-${this.account}-*`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
  }
}
