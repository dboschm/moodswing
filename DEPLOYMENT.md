# Deployment

Everything is one CDK stack, `MoodswingStack`, in `eu-central-1`.

## What gets created

| Resource | Notes |
| --- | --- |
| DynamoDB table | On-demand, `pk`/`sk`, TTL on `expiresAt`. Deleted with the stack. |
| Lambda `SessionFunction` | Node 24 on ARM, bundled with esbuild. Logs are kept for 1 week. |
| API Gateway WebSocket API | Routes `$connect`, `$disconnect`, `$default`, `createSession`, `join`, `vote`, `endSession`; stage `prod` throttled to 100 req/s (burst 200). |
| S3 bucket + CloudFront | Private bucket behind Origin Access Control, SPA fallback to `index.html`. |
| Bucket deployment | Uploads the built client plus `config.json` holding the WebSocket URL, then invalidates CloudFront. |

## Prerequisites

- Node 24 (`nvm use`) and `npm install` in both the project root and `cdk/`.
- AWS credentials for the target account in your shell (`aws sts get-caller-identity` should work).
- CDK bootstrapped once per account and region:

  ```sh
  cd cdk
  npx cdk bootstrap aws://<account-id>/eu-central-1
  ```

## Deploy

```sh
cd cdk
npx cdk diff      # optional: review changes
npx cdk deploy
```

Synthesis runs `npm run build` in the project root, so a type error stops the deploy. Docker is only needed if the local build fails.

Outputs:

- `HttpsUrl`: the app, for example `https://dxxxxxxxxxxxx.cloudfront.net`
- `WebSocketUrl`: `wss://…execute-api.eu-central-1.amazonaws.com/prod`. Also handy as `VITE_WS_URL` for local development.
- `TableName`

## Release checklist

1. `npm test && npm run build` in the root, and `npm test` in `cdk/`.
2. `npx cdk deploy`.
3. Open `HttpsUrl` on a laptop and a phone. Create a session, join it from the other device, swing both, then end the session and check that both show the summary.
4. Check the `SessionFunction` log group in CloudWatch for errors.

## Limits worth knowing

- Sessions expire 24 hours after creation. API Gateway closes WebSockets after 2 hours (10 minutes idle). The client sends heartbeats and reconnects on its own.
- A session accepts up to 200 voters.
- Session codes are checked for collisions when created. Creator tokens are stored only as SHA-256 hashes.

## Tear down

```sh
cd cdk
npx cdk destroy
```

The table, bucket and logs are removed with the stack.
