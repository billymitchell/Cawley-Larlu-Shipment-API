import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';
import 'dotenv/config';

const app = express();
app.use(bodyParser.json());

// Function to process a single order
async function processOrder(orderPayload) {
    const results = [];

    try {
        // Log the incoming order payload for debugging purposes
        console.log('Processing order:', orderPayload);

        // Sanitize the source_id by removing " REDO" and "-RESHIP"
        if (orderPayload.source_id) {
            orderPayload.source_id = orderPayload.source_id
                .replace(' REDO', '')
                .replace('-RESHIP', '');
        }

        // Remove shipment_date and add carrier_code and shipment_method to the payload
        const modifiedPayload = {
            ...orderPayload,
            carrier_code: 'UPS',
            shipment_method: 'Ground',
        };
        delete modifiedPayload.shipment_date;

        // Log the modified payload for debugging purposes
        console.log('Modified payload:', modifiedPayload);

        // Send a POST request to the external endpoint with the modified payload
        const response = await fetch('https://orderdesk-single-order-ship-65ffd8ceba36.herokuapp.com/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(modifiedPayload),
        });

        if (response.ok) {
            // Parse the response from the external endpoint
            const responseData = await response.json();
            console.log('POST request successful:', responseData);

            results.push({
                order: orderPayload,
                response: responseData,
            });
        } else {
            // Handle errors returned by the external endpoint
            const errorData = await response.json();
            console.error('POST request failed with status:', response.status, 'Error:', errorData);

            results.push({
                order: orderPayload,
                error: {
                    status: response.status,
                    message: errorData,
                },
            });
        }
    } catch (error) {
        // Handle network or unexpected errors
        console.error('Error sending POST request:', error.message, 'Stack:', error.stack);

        results.push({
            order: orderPayload,
            error: {
                message: error.message,
                stack: error.stack,
            },
        });
    }

    return results;
}

// POST endpoint to process orders
app.post('/', async (request, response) => {
    try {
        // Log the incoming request body for debugging purposes
        console.log('Received request body:', request.body);

        // Support both a single order object or an array of orders
        const orders = Array.isArray(request.body) ? request.body : [request.body];
        const results = [];

        // Process each order payload
        for (const orderPayload of orders) {
            const orderResults = await processOrder(orderPayload);
            results.push(...orderResults);
        }

        // Determine the response status based on whether any errors occurred
        const hasErrors = results.some(result => result.error);
        const statusCode = hasErrors ? 400 : 200;
        const responseMessage = hasErrors ? 'Some orders failed to process' : 'All orders processed successfully';

        // Log the consolidated results for debugging purposes
        console.log('Processing results:', results);

        // Send the response back to the client
        response.status(statusCode).json({
            message: responseMessage,
            results: results,
        });
    } catch (error) {
        // Catch and handle any unexpected errors during processing
        console.error('Error processing orders:', error.message, 'Stack:', error.stack);

        response.status(500).json({
            message: 'Internal server error while processing orders',
            error: {
                message: error.message,
                stack: error.stack,
            },
        });
    }
});

// Start the server and log the port information
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}: http://localhost:${port}`);
});