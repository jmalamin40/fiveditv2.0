const { registerDomain } = require('../utils/dynadotRegister');

registerDomain('lamiahouse.com', 1).then((res) => {
  console.log('Domain registered successfully');
  console.log(res);
}).catch((err) => {
  console.error('Domain registration failed');
  console.error(err);
});