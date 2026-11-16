import { execSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AllowedMethods, Distribution, PriceClass, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source, type ISource } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

const projectRoot = path.join(__dirname, '../..');

/** Client actions with their own API Gateway route; `ping` falls through to $default. */
const ACTION_ROUTES = ['createSession', 'join', 'vote', 'endSession', 'soothe', 'restartSession'];

export interface MoodswingStackProps extends cdk.StackProps {
  /** The built web app. Defaults to running `npm run build` in the project root. */
  webSource?: ISource;
}

/** Builds the React client locally and hands its dist/ folder to the deployment. */
function buildWebApp(): ISource {
  return Source.asset(projectRoot, {
    assetHashType: cdk.AssetHashType.OUTPUT,
    bundling: {
      image: cdk.DockerImage.fromRegistry('node:24'),
      local: {
        tryBundle(outputDir: string): boolean {
          execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });

          const distPath = path.join(projectRoot, 'dist');

          if (!existsSync(distPath)) {
            throw new Error(`Webapp build did not produce ${distPath}`);
          }

          for (const entry of readdirSync(distPath)) {
            cpSync(path.join(distPath, entry), path.join(outputDir, entry), { recursive: true });
          }

          return true;
        },
      },
    },
  });
}

export class MoodswingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MoodswingStackProps = {}) {
    super(scope, id, props);

    // Sessions are throwaway, so the table goes away with the stack.
    const table = new Table(this, 'SessionTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const sessionFunction = new NodejsFunction(this, 'SessionFunction', {
      entry: path.join(projectRoot, 'backend/handler.ts'),
      handler: 'handler',
      projectRoot,
      depsLockFilePath: path.join(projectRoot, 'package-lock.json'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: { minify: true, sourceMap: true },
      logGroup: new LogGroup(this, 'SessionFunctionLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    table.grantReadWriteData(sessionFunction);

    const integration = new WebSocketLambdaIntegration('SessionIntegration', sessionFunction);
    const webSocketApi = new WebSocketApi(this, 'MoodSocketApi', {
      routeSelectionExpression: '$request.body.action',
      connectRouteOptions: { integration },
      disconnectRouteOptions: { integration },
      defaultRouteOptions: { integration },
    });

    for (const action of ACTION_ROUTES) {
      webSocketApi.addRoute(action, { integration });
    }

    // A shared integration only gets invoke permission for the first route it is bound to ($connect),
    // so allow every route and stage of this API explicitly.
    sessionFunction.addPermission('InvokeFromWebSocketApi', {
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: this.formatArn({ service: 'execute-api', resource: webSocketApi.apiId, resourceName: '*' }),
    });

    const stage = new WebSocketStage(this, 'ProdStage', {
      webSocketApi,
      stageName: 'prod',
      autoDeploy: true,
      throttle: { rateLimit: 100, burstLimit: 200 },
    });
    stage.grantManagementApiAccess(sessionFunction);

    const webBucket = new Bucket(this, 'WebBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(webBucket),
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      // Session links like /MS-K7Q4XZ are client-side routes.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    new BucketDeployment(this, 'DeployWebApp', {
      sources: [
        props.webSource ?? buildWebApp(),
        // The WebSocket URL only exists after deployment, so the client reads it at runtime.
        Source.jsonData('config.json', { wsUrl: stage.url }),
      ],
      destinationBucket: webBucket,
      // Keep earlier hashed assets so a browser holding a cached index.html still loads.
      prune: false,
      distribution,
      distributionPaths: ['/*'],
    });

    new cdk.CfnOutput(this, 'HttpsUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'WebSocketUrl', { value: stage.url });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
