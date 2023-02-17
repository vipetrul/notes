import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { NetworkingStack } from './networking-stack';

export interface Props {
    networkingStack: NetworkingStack;
}

export class DatabaseStack extends cdk.Stack {
    sqlServerInstance: cdk.aws_rds.DatabaseInstance;

    constructor(scope: Construct, id: string, props: Props, stackProps?: cdk.StackProps) {
        super(scope, id, stackProps);

        // Set up an RDS SQL Server instance with Windows auth to the Active Directory.

        // Create a SQL Server instance inside the VPC and joined to the existing directory.
        this.sqlServerInstance = new rds.DatabaseInstance(this, 'web-sql-rds', {
            engine: rds.DatabaseInstanceEngine.sqlServerSe({ version: rds.SqlServerEngineVersion.VER_15 }),
            licenseModel: rds.LicenseModel.LICENSE_INCLUDED,
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE3, ec2.InstanceSize.XLARGE),
            vpc: props.networkingStack.vpc,
            vpcSubnets: props.networkingStack.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }),
            credentials: rds.Credentials.fromGeneratedSecret('web_dbo'),
            autoMinorVersionUpgrade: true,

            // You may wish to change these settings in a production environment.
            deletionProtection: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        // Set up credential rotation for the DB administrator user.
        this.sqlServerInstance.addRotationSingleUser();

        // Create an IAM Role with the `AmazonRDSDirectoryServiceAccess` policy. This is required to join the SQL Server to the domain.
        const dbRole = new iam.Role(this, 'rds-role', {
            assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonRDSDirectoryServiceAccess'),
            ],
        });

        // Join the SQL server to the domain. This isn't available in CDK yet, so use the CloudFormation primitives.
        const cfnSqlServerInstance = this.sqlServerInstance.node.defaultChild as rds.CfnDBInstance;
        cfnSqlServerInstance.domain = props.networkingStack.activeDirectory.attrAlias;
        cfnSqlServerInstance.domainIamRoleName = dbRole.roleName;

        // Allow the AD management instance to connect to the database, so the management instance can be used to set up the database access.
        this.sqlServerInstance.connections.allowDefaultPortFrom(
            props.networkingStack.directoryManagementInstance,
            'Consider removing this rule after the database deployment is complete.'
        );
    }
}
