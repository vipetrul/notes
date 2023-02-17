#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkingStack } from '../lib/networking-stack';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';
import { Tags } from 'aws-cdk-lib';

const app = new cdk.App();

const env = { account: '111111111', region: 'us-east-2' };

const networkingStack = new NetworkingStack(app, 'NetworkingStack', { env });

const databaseStack = new DatabaseStack(
    app,
    'DatabaseStack',
    {
        networkingStack,
    },
    { env }
);
databaseStack.addDependency(networkingStack);

const apiStack = new ApiStack(app, 'ApiStack', { networkingStack, databaseStack }, { env });
apiStack.addDependency(networkingStack);
apiStack.addDependency(databaseStack);

Tags.of(app).add('Service', 'KerberosOnLambda');
