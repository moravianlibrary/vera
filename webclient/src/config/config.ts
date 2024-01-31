const env = process.env.REACT_APP_ENV || "local";
const config = require(`./config.${env}.ts`);
export default config;
