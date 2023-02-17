import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { NetworkingStack } from './networking-stack';
import { DatabaseStack } from './database-stack';

export interface Props {
    networkingStack: NetworkingStack;
    databaseStack: DatabaseStack;
}

export class ApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: Props, stackProps?: cdk.StackProps) {
        super(scope, id, stackProps);

        const region = cdk.Stack.of(this).region;
        const account = cdk.Stack.of(this).account;
        const SsmParametersPrefix = '/kerberos-on-lambda';

        const activeDirectoryName = props.networkingStack.activeDirectory.name;
        const dbIdentifier = props.databaseStack.sqlServerInstance.instanceIdentifier;
        const db = props.databaseStack.sqlServerInstance.node.defaultChild as cdk.aws_rds.CfnDBInstance;
        const dbSecurityGroupsIds = db.vpcSecurityGroups;

        if (!dbSecurityGroupsIds) {
            throw new Error('Database security groups not found');
        }

        //Allow lambda security group to talk to database.
        const databaseSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
            this,
            'DbSecurityGroup',
            dbSecurityGroupsIds[0]
        );

        const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
            vpc: props.networkingStack.vpc,
            description: 'Lambda with Kerberos',
        });

        databaseSecurityGroup.connections.allowFrom(lambdaSecurityGroup, ec2.Port.tcp(1433));

        const apiLambda = new lambda.Function(this, 'LambdaWithKerberos', {
            runtime: lambda.Runtime.DOTNET_6,
            memorySize: 1400,
            vpc: props.networkingStack.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            securityGroups: [lambdaSecurityGroup],
            code: lambda.AssetCode.fromAsset('./api/LambdaApi/src/LambdaApi', {
                bundling: {
                    image: lambda.Runtime.DOTNET_6.bundlingImage,
                    command: ['bash', '-c', 'dotnet lambda package -o /asset-output/lambda.zip /p:UseAppHost=false'],
                    environment: {
                        DOTNET_CLI_HOME: '/tmp/DOTNET_CLI_HOME',
                        XDG_DATA_HOME: '/tmp/DOTNET_CLI_HOME',
                    },
                },
            }),
            handler: 'LambdaApi',
            environment: {
                ConnectionStrings__MyDb: `Server=${dbIdentifier}.${activeDirectoryName};Database=myDb;Integrated Security=true;Trust Server Certificate=true;`,
                SsmParametersPrefix: SsmParametersPrefix,
                KerberosSettings__RealmKdc: props.networkingStack.activeDirectory.name,
            },
        });

        apiLambda.role?.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole')
        );

        const apiGateway = new apigw2.CfnApi(this, 'ApiGateway', {
            name: 'KerberosOnLambdaApi',
            protocolType: 'HTTP',
        });

        apiLambda.addPermission('InvokeLambda', {
            principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
            action: 'lambda:InvokeFunction',
            sourceArn: `arn:aws:execute-api:${region}:${account}:${apiGateway.ref}/*/*`,
        });

        const apiStage = new apigw2.CfnStage(this, 'ApiStage', {
            apiId: apiGateway.ref,
            stageName: '$default',
            autoDeploy: true,
        });

        const apiIntegration = new apigw2.CfnIntegration(this, 'ApiIntegration', {
            apiId: apiGateway.ref,
            integrationUri: apiLambda.functionArn,
            integrationType: 'AWS_PROXY',
            integrationMethod: 'POST',
            payloadFormatVersion: '2.0',
        });

        const defaultRoute = new apigw2.CfnRoute(this, 'DefaultRoute', {
            apiId: apiGateway.ref,
            routeKey: '$default',
            target: `integrations/${apiIntegration.ref}`,
            authorizationType: 'NONE',
        });

        // Create a SSM parameter where key tab will be stored.
        // Normally it would be a SecureString parameter created outside of CDK (since CDK doesn't allow to create )
        const keyTab = new ssm.StringParameter(this, 'KeyTab', {
            description: 'KeyTab file in base-64 encoding',
            parameterName: `${SsmParametersPrefix}/KerberosSettings/KeyTabBase64`,
            stringValue: 'replace with keytab manually', //update value manually with the db-user keytab in base-64
            tier: ssm.ParameterTier.STANDARD,
            dataType: ssm.ParameterDataType.TEXT,
        });

        // Grant permissions to read all parameters for a given prefix
        apiLambda.role?.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['ssm:DescribeParameters', 'ssm:GetParameter*'],
                resources: [`arn:aws:ssm:${region}:${account}:parameter${SsmParametersPrefix}`],
            })
        );

        new cdk.CfnOutput(this, 'ApiGatewayUrl', {
            value: apiGateway.attrApiEndpoint,
        });
    }
}
