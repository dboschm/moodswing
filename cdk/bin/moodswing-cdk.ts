import * as cdk from 'aws-cdk-lib';
import { MoodswingStack } from '../lib/moodswing-stack';

const app = new cdk.App();

new MoodswingStack(app, 'MoodswingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'eu-central-1',
  },
});
