import "dotenv/config";
import { pubSubDataSource } from "./pubsub-data-source";

function getCredentials() {
    return {
        login: process.env.LOGIN_JUMPSELLER_API,
        authtoken: process.env.TOKEN_JUMPSELLER_API,
        baseUrl: process.env.JUMPSELLER_BASE_URL || "https://api.jumpseller.com/v1",
    };
}

// Existing API functions remain the same for initial data loading
export async function listProducts() {
    const { login, authtoken, baseUrl } = getCredentials();
    const url = `${baseUrl}/products.json`;
    try {
        const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": "Basic " + btoa(`${login}:${authtoken}`),
            "Content-Type": "application/json",
        },
        });

        if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error calling Jumpseller API:", error);
        return [];
    }
}

export async function listReviews() {
    const { login, authtoken, baseUrl } = getCredentials();
    const url = `${baseUrl}/products/reviews.json`;
    try {
        const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": "Basic " + btoa(`${login}:${authtoken}`),
            "Content-Type": "application/json",
        },
        });

        if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error calling Jumpseller API:", error);
        return [];
    }
}

export async function listCustomers() {
    const { login, authtoken, baseUrl } = getCredentials();
    const url = `${baseUrl}/customers.json`;
    try {
        const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": "Basic " + btoa(`${login}:${authtoken}`),
            "Content-Type": "application/json",
        },
        });

        if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error calling Jumpseller API:", error);
        return [];
    }
}

export async function listOrders() {
    const { login, authtoken, baseUrl } = getCredentials();
    const url = `${baseUrl}/orders.json`;
    try {
        const response = await fetch(url, {
        method: "GET",
        headers: {
            "Authorization": "Basic " + btoa(`${login}:${authtoken}`),
            "Content-Type": "application/json",
        },
        });

        if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error calling Jumpseller API:", error);
        return [];
    }
}

// New function to initialize real-time data updates
export async function initializeRealTimeUpdates(): Promise<void> {
    try {
        await pubSubDataSource.initialize();
        console.log('Real-time data updates initialized');
    } catch (error) {
        console.error('Failed to initialize real-time updates:', error);
    }
}