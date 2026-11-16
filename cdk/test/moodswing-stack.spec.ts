import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import { beforeAll, describe, expect, it } from 'vitest';
import { MoodswingStack } from '../lib/moodswing-stack';

describe('MoodswingStack', () => {
  let template: Template;

  beforeAll(() => {
    // Skip asset bundling (esbuild and the client build) to keep the test fast.
    const app = new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
    const stack = new MoodswingStack(app, 'TestStack', {
      env: { account: '123456789012', region: 'eu-central-1' },
      webSource: Source.data('index.html', '<!doctype html>'),
    });
    template = Template.fromStack(stack);
  });

  it('stores sessions in an on-demand table with TTL', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
    });
  });

  it('runs the session Lambda on Node 24 ARM with the table name', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Environment: { Variables: Match.objectLike({ TABLE_NAME: Match.anyValue() }) },
    });
  });

  it('routes every WebSocket action to the Lambda', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Api', {
      ProtocolType: 'WEBSOCKET',
      RouteSelectionExpression: '$request.body.action',
    });

    const routeKeys = Object.values(template.findResources('AWS::ApiGatewayV2::Route')).map(
      (route) => route.Properties.RouteKey,
    );
    expect(routeKeys.sort()).toEqual(
      ['$connect', '$default', '$disconnect', 'createSession', 'endSession', 'join', 'vote'].sort(),
    );
    template.resourceCountIs('AWS::ApiGatewayV2::Integration', 1);
  });

  it('lets the Lambda push to connections', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([Match.objectLike({ Action: 'execute-api:ManageConnections' })]),
      },
    });
  });

  it('throttles the WebSocket stage', () => {
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: 'prod',
      AutoDeploy: true,
      DefaultRouteSettings: { ThrottlingRateLimit: 100, ThrottlingBurstLimit: 200 },
    });
  });

  it('writes the WebSocket URL into config.json next to the client', () => {
    const [deployment] = Object.values(template.findResources('Custom::CDKBucketDeployment'));
    const markers = JSON.stringify(deployment.Properties.SourceMarkers);

    expect(deployment.Properties.SourceObjectKeys).toHaveLength(2);
    expect(markers).toContain('wss://');
    expect(markers).toContain('/prod');
  });

  it('serves the client privately through CloudFront', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
        ]),
      }),
    });
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: Match.objectLike({ BlockPublicAcls: true, RestrictPublicBuckets: true }),
    });
  });
});
