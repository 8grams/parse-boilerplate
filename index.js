require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const ParseServer = require('parse-server').ParseServer;
const ParseDashboard = require('parse-dashboard');
const RedisCacheAdapter = require('parse-server').RedisCacheAdapter;
const { SES, SendEmailCommand } = require('@aws-sdk/client-ses');
const { ApiPayloadConverter } = require('parse-server-api-mail-adapter');

const { fromEnv } = require('@aws-sdk/credential-providers');

const credentialProvider = fromEnv();
const credentials = credentialProvider();

const sesClient = new SES({
    credentials,
    region: process.env.AWS_DEFAULT_REGION,
    apiVersion: '2010-12-01'
});

const app = express();

const api = new ParseServer({
    serverURL: process.env.SERVER_URL,
    publicServerURL: process.env.SERVER_URL,
    databaseURI: process.env.PARSE_POSTGRESQL_URI || "",
    cloud: './cloud/main.js',
    appId: process.env.PARSE_APP_ID || "",
    appName: process.env.APP_NAME || "",
    fileKey: process.env.PARSE_FILE_KEY || "",
    masterKey: process.env.PARSE_MASTER_KEY || "",
    clientKey: process.env.PARSE_CLIENT_KEY || "",
    restAPIKey: process.env.PARSE_REST_API_KEY || "",
    javascriptKey: process.env.PARSE_JAVASCRIPT_KEY || "",
    "filesAdapter": {
        "module": "@parse/s3-files-adapter",
        "options": {
            "bucket": process.env.AWS_S3_BUCKET || "my-bucket",
            "region": process.env.AWS_DEFAULT_REGION,
            "bucketPrefix": process.env.AWS_S3_BUCKET_PREFIX || "production",
            "directAccess": true, 
        }
    },
    cacheAdapter: new RedisCacheAdapter({
        url: process.env.REDIS_URL || "redis://redis-master:6379"
    }),
    verifyUserEmails: true,
    emailVerifyTokenValidityDuration: 2 * 60 * 60,
    emailAdapter: {
        module: 'parse-server-api-mail-adapter',
        options: {
            sender: process.env.EMAIL_SENDER || "admin@example.com",
            templates: {
                passwordResetEmail: {
                    subjectPath: './email/password_reset_email_subject.txt',
                    textPath: './email/password_reset_email.txt',
                    htmlPath: './email/password_reset_email.html'
                },
            },
            apiCallback: async ({ payload }) => {
                const awsSesPayload = ApiPayloadConverter.awsSes(payload);
                const command = new SendEmailCommand(awsSesPayload);
                await sesClient.send(command);
            },
        }   
    },
    // account things
    accountLockout: {
        duration: 5,
        threshold: 3,
        unlockOnPasswordReset: true,
    },
    passwordPolicy: {
        validatorPattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.{8,})/,
        doNotAllowUsername: true,
        maxPasswordHistory: 5,
    },
    logLevel: "VERBOSE",
});

const dashboard = new ParseDashboard({
    "apps": [{
        serverURL: process.env.SERVER_URL,
        graphQLServerURL: process.env.GRAPHQL_URL || "",
        appId: process.env.PARSE_APP_ID || "",
        masterKey: process.env.PARSE_MASTER_KEY || "",
        appName: process.env.APP_NAME || ""
    }],
    "trustProxy": 1,
    "users": [{
        "user": process.env.PARSE_DASHBOARD_USERNAME || "",
        "pass": process.env.PARSE_DASHBOARD_PASSWORD || "",
    }],
    "useEncryptedPasswords": false,
}, { "allowInsecureHTTP": false });

app.use(bodyParser.json());
app.use(cors());


app.use('/parse', api);
app.use('/dashboard', dashboard);

app.get('/health_check', (req, res) => {
    res.status(200).send('Ok');
});

const port = process.env.APP_PORT || "1337";
app.listen(port, function() {
    console.log('parse-server running on port ' + port + '.');
});
