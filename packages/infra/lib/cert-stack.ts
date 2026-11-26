import { Stack, type StackProps } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export interface CertStackProps extends StackProps {
  domainName: string;
}

/** CloudFront only accepts certificates from us-east-1, so the site's certificate lives in its own stack there. */
export class CertStack extends Stack {
  readonly certificate: Certificate;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);
    const zone = HostedZone.fromLookup(this, 'Zone', { domainName: props.domainName });
    this.certificate = new Certificate(this, 'SiteCertificate', {
      domainName: props.domainName,
      subjectAlternativeNames: [`www.${props.domainName}`],
      validation: CertificateValidation.fromDns(zone),
    });
  }
}
