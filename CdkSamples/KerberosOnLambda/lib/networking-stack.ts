import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as directory from 'aws-cdk-lib/aws-directoryservice';

export class NetworkingStack extends cdk.Stack {
    vpc: cdk.aws_ec2.Vpc;
    activeDirectory: cdk.aws_directoryservice.CfnMicrosoftAD;
    directoryManagementInstance: cdk.aws_ec2.Instance;
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // new key pair will be saved in SSM Parameter Store at /ec2/keypair/{key_pair_id}
        const keyPair = new ec2.CfnKeyPair(this, 'KerberosOnLambdaKeyPair', {
            keyName: 'KerberosOnLambda',
        });

        new cdk.CfnOutput(this, 'KeyPairSsnParameterLocation', { value: `/ec2/keypair/${keyPair.attrKeyPairId}` });

        // Create VPC
        this.vpc = new ec2.Vpc(this, 'vpc', {
            cidr: '172.20.0.0/16',
            subnetConfiguration: [
                {
                    subnetType: ec2.SubnetType.PUBLIC,
                    name: 'Public',
                },
                {
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    name: 'Private',
                },
            ],
        });

        // Create AWS Managed Active Directory
        // Create a secure password for the Active Directory admin user and store it in Secrets Manager.
        const activeDirectoryAdminPasswordSecret = new secretsmanager.Secret(
            this,
            'active-directory-admin-password-secret',
            {
                secretName: '/kerberos-on-lambda/active-directory-administrator-password',
                generateSecretString: {
                    excludeCharacters: '"\'', // Passwords with quotes are hard to work with on the command line.
                },
            }
        );

        new cdk.CfnOutput(this, 'ActiveDirectoryAdminPasswordSecretARN', {
            value: activeDirectoryAdminPasswordSecret.secretArn,
        });

        this.activeDirectory = new directory.CfnMicrosoftAD(this, 'directory', {
            name: 'directory.kerberos-on-lambda-sample.com',
            password: activeDirectoryAdminPasswordSecret.secretValue.unsafeUnwrap(),
            edition: 'Standard',
            vpcSettings: {
                vpcId: this.vpc.vpcId,
                subnetIds: [this.vpc.publicSubnets[0].subnetId, this.vpc.publicSubnets[1].subnetId],
            },
        });

        // Deploy a Windows EC2 instance to manage the Active Directory.
        // In a typical deployment, this instance is likely unnecessary.
        const windowsServerImage = ec2.MachineImage.lookup({
            name: 'Windows_Server-2019-English-Full-Base*',
            windows: true,
        });

        this.directoryManagementInstance = new ec2.Instance(this, 'active-directory-management-instance', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
            machineImage: windowsServerImage,
            vpc: this.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            keyName: keyPair.keyName,
        });

        // These steps are required even if using an existing directory.

        // Create a DHCP Options Set so the VPC uses the Active Directory DNS servers.
        const activeDirectoryDhcpOptionsSet = new ec2.CfnDHCPOptions(this, 'directory-dhcp-os', {
            domainNameServers: this.activeDirectory.attrDnsIpAddresses,
        });

        new ec2.CfnVPCDHCPOptionsAssociation(this, 'directory-dhcp-os-association', {
            vpcId: this.vpc.vpcId,
            dhcpOptionsId: activeDirectoryDhcpOptionsSet.ref,
        });

        const ssmEndpoint = this.vpc.addInterfaceEndpoint('ssm-endpoint', {
            service: ec2.InterfaceVpcEndpointAwsService.SSM,
            privateDnsEnabled: true, // This must be enabled
        });
    }
}
