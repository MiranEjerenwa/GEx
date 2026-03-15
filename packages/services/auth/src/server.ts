import { createApp } from './app';

const config = {
  pools: {
    purchaser: {
      userPoolId: process.env.PURCHASER_USER_POOL_ID ?? '',
      clientId: process.env.PURCHASER_CLIENT_ID ?? '',
    },
    partner: {
      userPoolId: process.env.PARTNER_USER_POOL_ID ?? '',
      clientId: process.env.PARTNER_CLIENT_ID ?? '',
    },
    admin: {
      userPoolId: process.env.ADMIN_USER_POOL_ID ?? '',
      clientId: process.env.ADMIN_CLIENT_ID ?? '',
    },
  },
  region: process.env.AWS_REGION ?? 'us-east-1',
};

const port = process.env.PORT ?? 3000;
const { app } = createApp(config);

app.listen(port, () => {
  console.log(`Auth service listening on port ${port}`);
});
