const axios = require('axios');

const lambdaUrl = "https://3btasm5mawjeluvyvcuenofnau0teqfc.lambda-url.ap-south-1.on.aws/";

async function testLambda() {
    try {
        const response = await axios.get(lambdaUrl);
        console.log("Response Data:", response.data);
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

testLambda();
