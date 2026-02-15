require('dotenv').config();

const { deliverOtpEmail } = require('../api/helper/otpEmail');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
    args[key] = value;
  }
  return args;
};

const main = async () => {
  const args = parseArgs(process.argv);
  const to = args.to || process.env.SMTP_TEST_TO;

  if (!to || typeof to !== 'string') {
    console.error('Missing recipient. Use `--to someone@example.com` or set `SMTP_TEST_TO`.');
    process.exit(2);
  }

  const otp = String(args.otp || '123456');
  const expiresMinutes = Number.isFinite(Number(args.expires)) ? Number(args.expires) : 5;

  const result = await deliverOtpEmail({ to, otp, expiresMinutes });
  console.log('Result:', result);
  process.exit(result.ok ? 0 : 1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

