#!/usr/bin/env node

/**
 * API Testing MCP Server for Mi Rosarita AI App
 *
 * Provides tools for testing external API integrations used in the travel app.
 * This server enables AI assistants to:
 * - Test Amadeus flight and hotel API integrations
 * - Test Stripe payment processing
 * - Validate API responses and error handling
 * - Monitor API rate limits and usage
 * - Simulate API responses for testing
 * - Generate mock data for development
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';

class APITestingMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'api-testing-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.apiConfigs = {};
    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'api_configure_keys',
            description: 'Configure API keys for different services',
            inputSchema: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  description: 'API service name (amadeus, stripe, google_maps)',
                  enum: ['amadeus', 'stripe', 'google_maps'],
                },
                api_key: {
                  type: 'string',
                  description: 'API key for the service',
                },
                api_secret: {
                  type: 'string',
                  description: 'API secret for services that require it (optional)',
                },
              },
              required: ['service', 'api_key'],
            },
          },
          {
            name: 'amadeus_test_flights',
            description: 'Test Amadeus flight search API',
            inputSchema: {
              type: 'object',
              properties: {
                origin: {
                  type: 'string',
                  description: 'Origin airport code (e.g., LAX, SFO)',
                  default: 'LAX',
                },
                destination: {
                  type: 'string',
                  description: 'Destination airport code (e.g., TIJ)',
                  default: 'TIJ',
                },
                departure_date: {
                  type: 'string',
                  description: 'Departure date (YYYY-MM-DD)',
                  default: '2024-12-25',
                },
                return_date: {
                  type: 'string',
                  description: 'Return date (YYYY-MM-DD, optional)',
                },
                adults: {
                  type: 'number',
                  description: 'Number of adult passengers',
                  default: 1,
                },
                mock_response: {
                  type: 'boolean',
                  description: 'Return mock data instead of real API call',
                  default: false,
                },
              },
            },
          },
          {
            name: 'amadeus_test_hotels',
            description: 'Test Amadeus hotel search API',
            inputSchema: {
              type: 'object',
              properties: {
                city_code: {
                  type: 'string',
                  description: 'IATA city code (e.g., TJI for Tijuana)',
                  default: 'TJI',
                },
                check_in_date: {
                  type: 'string',
                  description: 'Check-in date (YYYY-MM-DD)',
                  default: '2024-12-25',
                },
                check_out_date: {
                  type: 'string',
                  description: 'Check-out date (YYYY-MM-DD)',
                  default: '2024-12-27',
                },
                adults: {
                  type: 'number',
                  description: 'Number of adult guests',
                  default: 2,
                },
                mock_response: {
                  type: 'boolean',
                  description: 'Return mock data instead of real API call',
                  default: false,
                },
              },
            },
          },
          {
            name: 'stripe_test_payment',
            description: 'Test Stripe payment processing',
            inputSchema: {
              type: 'object',
              properties: {
                amount: {
                  type: 'number',
                  description: 'Payment amount in cents',
                  default: 5000,
                },
                currency: {
                  type: 'string',
                  description: 'Payment currency',
                  default: 'usd',
                },
                description: {
                  type: 'string',
                  description: 'Payment description',
                  default: 'Travel booking payment',
                },
                payment_method_types: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Allowed payment method types',
                  default: ['card'],
                },
                mock_response: {
                  type: 'boolean',
                  description: 'Return mock data instead of real API call',
                  default: false,
                },
              },
            },
          },
          {
            name: 'google_maps_test_places',
            description: 'Test Google Places API for location data',
            inputSchema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'Location to search (e.g., "Playas de Rosarito")',
                  default: 'Playas de Rosarito, Mexico',
                },
                type: {
                  type: 'string',
                  description: 'Place type (restaurant, hotel, attraction)',
                  enum: ['restaurant', 'hotel', 'attraction', 'tourist_attraction'],
                  default: 'restaurant',
                },
                radius: {
                  type: 'number',
                  description: 'Search radius in meters',
                  default: 5000,
                },
                mock_response: {
                  type: 'boolean',
                  description: 'Return mock data instead of real API call',
                  default: false,
                },
              },
            },
          },
          {
            name: 'api_test_connection',
            description: 'Test basic connectivity to an API endpoint',
            inputSchema: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  description: 'API service to test',
                  enum: ['amadeus', 'stripe', 'google_maps'],
                },
                endpoint: {
                  type: 'string',
                  description: 'Specific endpoint to test (optional)',
                },
              },
              required: ['service'],
            },
          },
          {
            name: 'api_generate_mock_data',
            description: 'Generate mock data for testing purposes',
            inputSchema: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  description: 'API service to generate mock data for',
                  enum: ['amadeus', 'stripe', 'google_maps'],
                },
                data_type: {
                  type: 'string',
                  description: 'Type of data to generate',
                  enum: ['flights', 'hotels', 'payment_intent', 'places', 'bookings'],
                },
                count: {
                  type: 'number',
                  description: 'Number of items to generate',
                  default: 5,
                },
              },
              required: ['service', 'data_type'],
            },
          },
          {
            name: 'api_validate_response',
            description: 'Validate API response structure and data',
            inputSchema: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  description: 'API service',
                  enum: ['amadeus', 'stripe', 'google_maps'],
                },
                response: {
                  type: 'string',
                  description: 'JSON response to validate',
                },
                expected_schema: {
                  type: 'object',
                  description: 'Expected response schema (optional)',
                },
              },
              required: ['service', 'response'],
            },
          },
          {
            name: 'api_rate_limit_check',
            description: 'Check API rate limits and usage',
            inputSchema: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  description: 'API service to check',
                  enum: ['amadeus', 'stripe', 'google_maps'],
                },
              },
              required: ['service'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'api_configure_keys':
            return await this.configureAPIKeys(args);
          case 'amadeus_test_flights':
            return await this.testAmadeusFlights(args);
          case 'amadeus_test_hotels':
            return await this.testAmadeusHotels(args);
          case 'stripe_test_payment':
            return await this.testStripePayment(args);
          case 'google_maps_test_places':
            return await this.testGoogleMaps(args);
          case 'api_test_connection':
            return await this.testAPIConnection(args);
          case 'api_generate_mock_data':
            return await this.generateMockData(args);
          case 'api_validate_response':
            return await this.validateAPIResponse(args);
          case 'api_rate_limit_check':
            return await this.checkRateLimits(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler('resources/list', async () => {
      return {
        resources: [
          {
            uri: 'api://config/status',
            mimeType: 'application/json',
            name: 'API Configuration Status',
            description: 'Current API keys and configuration status',
          },
          {
            uri: 'api://amadeus/endpoints',
            mimeType: 'application/json',
            name: 'Amadeus API Endpoints',
            description: 'Available Amadeus API endpoints and documentation',
          },
          {
            uri: 'api://stripe/endpoints',
            mimeType: 'application/json',
            name: 'Stripe API Endpoints',
            description: 'Available Stripe API endpoints and documentation',
          },
          {
            uri: 'api://mock-data/templates',
            mimeType: 'application/json',
            name: 'Mock Data Templates',
            description: 'Templates for generating mock API responses',
          },
        ],
      };
    });

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'api://config/status':
            return await this.getConfigStatusResource();
          case 'api://amadeus/endpoints':
            return await this.getAmadeusEndpointsResource();
          case 'api://stripe/endpoints':
            return await this.getStripeEndpointsResource();
          case 'api://mock-data/templates':
            return await this.getMockDataTemplatesResource();
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async configureAPIKeys(args) {
    const { service, api_key, api_secret } = args;

    this.apiConfigs[service] = {
      api_key,
      api_secret: api_secret || null,
      configured_at: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: `API keys configured successfully for ${service}.\n\nConfiguration stored securely.`,
        },
      ],
    };
  }

  async testAmadeusFlights(args) {
    const {
      origin = 'LAX',
      destination = 'TIJ',
      departure_date = '2024-12-25',
      return_date,
      adults = 1,
      mock_response = false
    } = args;

    if (mock_response) {
      return this.getMockFlightData(origin, destination, departure_date);
    }

    if (!this.apiConfigs.amadeus || !this.apiConfigs.amadeus.api_key || !this.apiConfigs.amadeus.api_secret) {
      throw new Error('Amadeus API not configured. Use api_configure_keys first.');
    }

    try {
      const tokenResponse = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.apiConfigs.amadeus.api_key,
          client_secret: this.apiConfigs.amadeus.api_secret,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token request failed: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const searchParams = new URLSearchParams({
        originLocationCode: origin,
        destinationLocationCode: destination,
        departureDate: departure_date,
        adults: adults.toString(),
      });

      if (return_date) {
        searchParams.append('returnDate', return_date);
      }

      const flightsResponse = await fetch(
        `https://test.api.amadeus.com/v2/shopping/flight-offers?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!flightsResponse.ok) {
        throw new Error(`Flights search failed: ${flightsResponse.status}`);
      }

      const flightsData = await flightsResponse.json();

      return {
        content: [
          {
            type: 'text',
            text: `Amadeus flight search successful!\n\nFound ${flightsData.data?.length || 0} flight offers.\n\nFirst result:\n${JSON.stringify(flightsData.data?.[0], null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Amadeus API test failed: ${error.message}`);
    }
  }

  async testAmadeusHotels(args) {
    const {
      city_code = 'TJI',
      check_in_date = '2024-12-25',
      check_out_date = '2024-12-27',
      adults = 2,
      mock_response = false
    } = args;

    if (mock_response) {
      return this.getMockHotelData(city_code, check_in_date, check_out_date);
    }

    if (!this.apiConfigs.amadeus || !this.apiConfigs.amadeus.api_key || !this.apiConfigs.amadeus.api_secret) {
      throw new Error('Amadeus API not configured. Use api_configure_keys first.');
    }

    try {
      const tokenResponse = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.apiConfigs.amadeus.api_key,
          client_secret: this.apiConfigs.amadeus.api_secret,
        }),
      });

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      const searchParams = new URLSearchParams({
        cityCode: city_code,
        checkInDate: check_in_date,
        checkOutDate: check_out_date,
        adults: adults.toString(),
      });

      const hotelsResponse = await fetch(
        `https://test.api.amadeus.com/v3/shopping/hotel-offers?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!hotelsResponse.ok) {
        throw new Error(`Hotels search failed: ${hotelsResponse.status}`);
      }

      const hotelsData = await hotelsResponse.json();

      return {
        content: [
          {
            type: 'text',
            text: `Amadeus hotel search successful!\n\nFound ${hotelsData.data?.length || 0} hotel offers.\n\nFirst result:\n${JSON.stringify(hotelsData.data?.[0], null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Amadeus hotels API test failed: ${error.message}`);
    }
  }

  async testStripePayment(args) {
    const {
      amount = 5000,
      currency = 'usd',
      description = 'Travel booking payment',
      payment_method_types = ['card'],
      mock_response = false
    } = args;

    if (mock_response) {
      return this.getMockStripePaymentData(amount, currency);
    }

    if (!this.apiConfigs.stripe || !this.apiConfigs.stripe.api_secret) {
      throw new Error('Stripe API not configured. Use api_configure_keys first.');
    }

    try {
      const paymentIntentResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiConfigs.stripe.api_secret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          amount: amount.toString(),
          currency,
          'payment_method_types[]': payment_method_types,
          description,
        }),
      });

      if (!paymentIntentResponse.ok) {
        const errorData = await paymentIntentResponse.json();
        throw new Error(`Stripe payment intent creation failed: ${errorData.error?.message || paymentIntentResponse.status}`);
      }

      const paymentData = await paymentIntentResponse.json();

      return {
        content: [
          {
            type: 'text',
            text: `Stripe payment intent created successfully!\n\nClient Secret: ${paymentData.client_secret}\nAmount: $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}\n\nFull response:\n${JSON.stringify(paymentData, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Stripe API test failed: ${error.message}`);
    }
  }

  async testGoogleMaps(args) {
    const { location = 'Playas de Rosarito, Mexico', type = 'restaurant', radius = 5000, mock_response = false } = args;

    if (mock_response) {
      return this.getMockPlacesData(location, type);
    }

    if (!this.apiConfigs.google_maps || !this.apiConfigs.google_maps.api_key) {
      throw new Error('Google Maps API not configured. Use api_configure_keys first.');
    }

    try {
      const searchParams = new URLSearchParams({
        query: `${type} in ${location}`,
        key: this.apiConfigs.google_maps.api_key,
      });

      const placesResponse = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${searchParams}`);

      if (!placesResponse.ok) {
        throw new Error(`Places search failed: ${placesResponse.status}`);
      }

      const placesData = await placesResponse.json();

      return {
        content: [
          {
            type: 'text',
            text: `Google Places search successful!\n\nFound ${placesData.results?.length || 0} ${type}s.\n\nFirst result:\n${JSON.stringify(placesData.results?.[0], null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Google Maps API test failed: ${error.message}`);
    }
  }

  async testAPIConnection(args) {
    const { service, endpoint } = args;

    if (!this.apiConfigs[service]) {
      throw new Error(`${service} API not configured. Use api_configure_keys first.`);
    }

    const testEndpoints = {
      amadeus: 'https://test.api.amadeus.com/v1/security/oauth2/token',
      stripe: 'https://api.stripe.com/v1/account',
      google_maps: 'https://maps.googleapis.com/maps/api/geocode/json',
    };

    const testEndpoint = endpoint || testEndpoints[service];

    try {
      let headers = {};
      let body = null;

      if (service === 'amadeus') {
        headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        body = new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.apiConfigs.amadeus.api_key,
          client_secret: this.apiConfigs.amadeus.api_secret,
        });
      } else if (service === 'stripe') {
        headers = { 'Authorization': `Bearer ${this.apiConfigs.stripe.api_secret}` };
      } else if (service === 'google_maps') {
        const searchParams = new URLSearchParams({
          address: 'Rosarito, Mexico',
          key: this.apiConfigs.google_maps.api_key,
        });
        testEndpoint += `?${searchParams}`;
      }

      const response = await fetch(testEndpoint, {
        method: service === 'amadeus' ? 'POST' : 'GET',
        headers,
        body,
      });

      return {
        content: [
          {
            type: 'text',
            text: `${service} API connection test:\n\n✅ Status: ${response.status} ${response.statusText}\n📡 Endpoint: ${testEndpoint}\n🔗 Connection: ${response.ok ? 'Successful' : 'Failed'}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `${service} API connection test:\n\n❌ Error: ${error.message}\n📡 Endpoint: ${testEndpoint}`,
          },
        ],
        isError: true,
      };
    }
  }

  async generateMockData(args) {
    const { service, data_type, count = 5 } = args;

    switch (service) {
      case 'amadeus':
        if (data_type === 'flights') {
          return await this.getMockFlightData('LAX', 'TIJ', '2024-12-25', count);
        } else if (data_type === 'hotels') {
          return await this.getMockHotelData('TJI', '2024-12-25', '2024-12-27', count);
        }
        break;
      case 'stripe':
        if (data_type === 'payment_intent') {
          return await this.getMockStripePaymentData(5000, 'usd');
        }
        break;
      case 'google_maps':
        if (data_type === 'places') {
          return await this.getMockPlacesData('Playas de Rosarito', 'restaurant', count);
        }
        break;
    }

    throw new Error(`Unsupported data type: ${data_type} for service: ${service}`);
  }

  async validateAPIResponse(args) {
    const { service, response: responseStr, expected_schema } = args;

    try {
      const response = JSON.parse(responseStr);

      // Basic validation
      const Validation = {
        hasData: (obj) => obj && (obj.data || obj.results || obj.payment_intent || obj.places),
        isArray: (arr) => Array.isArray(arr),
        hasRequiredFields: (obj, fields) => fields.every(field => obj && obj[field] !== undefined),
      };

      const validStructure = this.validateStructure(response, service);

      let content = `API Response Validation for ${service}:\n\n`;

      if (validStructure) {
        content += '✅ Structure validation passed\n';
      } else {
        content += '❌ Structure validation failed\n';
      }

      // Additional validations based on service
      switch (service) {
        case 'amadeus':
          if (response.data && Array.isArray(response.data)) {
            content += `✅ Contains ${response.data.length} data items\n`;
            if (response.data.length > 0 && response.data[0].id) {
              content += '✅ Items have IDs\n';
            }
          }
          break;
        case 'stripe':
          if (response.client_secret) {
            content += '✅ Contains client_secret\n';
          }
          if (response.amount) {
            content += `✅ Payment amount: $${(response.amount / 100).toFixed(2)}\n`;
          }
          break;
        case 'google_maps':
          if (response.results && Array.isArray(response.results)) {
            content += `✅ Contains ${response.results.length} place results\n`;
            if (response.results.length > 0 && response.results[0].place_id) {
              content += '✅ Places have IDs\n';
            }
          }
          break;
      }

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (parseError) {
      return {
        content: [
          {
            type: 'text',
            text: `Response validation failed:\n❌ Invalid JSON: ${parseError.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async checkRateLimits(args) {
    const { service } = args;

    // Mock rate limit data - in a real implementation, you'd check actual API limits
    const rateLimits = {
      amadeus: {
        requests_per_second: 10,
        requests_per_day: 10000,
        current_usage: 'N/A (real-time data not available)',
      },
      stripe: {
        requests_per_second: 100,
        requests_per_day: 'Unlimited',
        current_usage: 'N/A (check Stripe dashboard)',
      },
      google_maps: {
        requests_per_second: 50,
        requests_per_day: 40000,
        current_usage: 'N/A (real-time data not available)',
      },
    };

    const limits = rateLimits[service];
    if (!limits) {
      throw new Error(`Rate limit data not available for ${service}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `${service.toUpperCase()} API Rate Limits:\n\n📊 Requests per second: ${limits.requests_per_second}\n📅 Requests per day: ${limits.requests_per_day}\n📈 Current usage: ${limits.current_usage}\n\n🔍 For real-time usage, check your ${service} dashboard.`,
        },
      ],
    };
  }

  validateStructure(response, service) {
    // Basic structure validation
    if (typeof response !== 'object' || response === null) {
      return false;
    }

    switch (service) {
      case 'amadeus':
        return !!(response.data && Array.isArray(response.data));
      case 'stripe':
        return !!(response.id && response.client_secret);
      case 'google_maps':
        return !!(response.results && Array.isArray(response.results));
      default:
        return true;
    }
  }

  getMockFlightData(origin, destination, departureDate, count = 5) {
    const flights = Array.from({ length: count }, (_, i) => ({
      id: `flight_${i + 1}`,
      itineraries: [{
        duration: 'PT4H30M',
        segments: [{
          departure: {
            iataCode: origin,
            terminal: '1',
            at: `${departureDate}T08:00:00`,
          },
          arrival: {
            iataCode: destination,
            terminal: '2',
            at: `${departureDate}T12:30:00`,
          },
          carrierCode: 'AA',
          number: '123',
          aircraft: { code: '737' },
          operating: { carrierCode: 'AA' },
        }],
      }],
      price: {
        currency: 'USD',
        total: (150 + i * 50).toString(),
        base: (120 + i * 40).toString(),
        fees: [{ amount: '30.00', type: 'TICKETING' }],
      },
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Mock Amadeus Flight Data:\n\nFound ${count} flight offers from ${origin} to ${destination}.\n\nSample:\n${JSON.stringify(flights[0], null, 2)}\n\n... and ${count - 1} more flights.`,
        },
      ],
    };
  }

  getMockHotelData(cityCode, checkInDate, checkOutDate, count = 5) {
    const hotels = Array.from({ length: count }, (_, i) => ({
      id: `hotel_${i + 1}`,
      name: `Hotel Rosarito ${i + 1}`,
      rating: (3 + Math.random() * 2).toFixed(1),
      hotelDistance: { distance: `${1 + i * 0.5}KM` },
      address: {
        lines: ['Main Street 123'],
        cityName: 'Rosarito',
        countryCode: 'MX',
      },
      offers: [{
        id: `offer_${i + 1}`,
        rateCode: 'STD',
        boardType: 'BREAKFAST',
        price: {
          currency: 'USD',
          base: (100 + i * 30).toString(),
          total: (120 + i * 35).toString(),
          taxes: [{ code: 'IVA', percentage: '16.00' }],
        },
      }],
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Mock Amadeus Hotel Data:\n\nFound ${count} hotel offers in ${cityCode}.\n\nSample:\n${JSON.stringify(hotels[0], null, 2)}\n\n... and ${count - 1} more hotels.`,
        },
      ],
    };
  }

  getMockStripePaymentData(amount, currency) {
    return {
      content: [
        {
          type: 'text',
          text: `Mock Stripe Payment Intent:\n\n{\n  "id": "pi_mock_1234567890",\n  "client_secret": "pi_mock_secret_abcdef123456",\n  "amount": ${amount},\n  "currency": "${currency}",\n  "status": "requires_payment_method",\n  "description": "Travel booking mock payment"\n}`,
        },
      ],
    };
  }

  getMockPlacesData(location, type, count = 5) {
    const places = Array.from({ length: count }, (_, i) => ({
      place_id: `place_mock_${i + 1}`,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${location} ${i + 1}`,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      vicinity: `${location}, Near Beach`,
      types: [type, 'establishment'],
      geometry: {
        location: {
          lat: 32.5333 + Math.random() * 0.1,
          lng: -117.1167 + Math.random() * 0.1,
        },
      },
      opening_hours: {
        open_now: Math.random() > 0.3,
      },
    }));

    return {
      content: [
        {
          type: 'text',
          text: `Mock Google Places Data:\n\nFound ${count} ${type}s in ${location}.\n\nSample:\n${JSON.stringify(places[0], null, 2)}\n\n... and ${count - 1} more places.`,
        },
      ],
    };
  }

  async getConfigStatusResource() {
    return {
      contents: [
        {
          uri: 'api://config/status',
          mimeType: 'application/json',
          text: JSON.stringify({
            configured_services: Object.keys(this.apiConfigs),
            amadeus: !!this.apiConfigs.amadeus,
            stripe: !!this.apiConfigs.stripe,
            google_maps: !!this.apiConfigs.google_maps,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  async getAmadeusEndpointsResource() {
    return {
      contents: [
        {
          uri: 'api://amadeus/endpoints',
          mimeType: 'application/json',
          text: JSON.stringify({
            base_url: 'https://test.api.amadeus.com',
            endpoints: {
              flights: {
                path: '/v2/shopping/flight-offers',
                method: 'GET',
                description: 'Search flight offers',
              },
              hotels: {
                path: '/v3/shopping/hotel-offers',
                method: 'GET',
                description: 'Search hotel offers',
              },
              hotel_details: {
                path: '/v3/shopping/hotel-offers/{hotelId}',
                method: 'GET',
                description: 'Get hotel details',
              },
              city_search: {
                path: '/v1/reference-data/locations/cities',
                method: 'GET',
                description: 'Search cities by keyword',
              },
            },
          }, null, 2),
        },
      ],
    };
  }

  async getStripeEndpointsResource() {
    return {
      contents: [
        {
          uri: 'api://stripe/endpoints',
          mimeType: 'application/json',
          text: JSON.stringify({
            base_url: 'https://api.stripe.com/v1',
            endpoints: {
              payment_intents: {
                path: '/payment_intents',
                method: 'POST',
                description: 'Create payment intent',
              },
              capture: {
                path: '/payment_intents/{id}/capture',
                method: 'POST',
                description: 'Capture payment',
              },
              refunds: {
                path: '/refunds',
                method: 'POST',
                description: 'Create refund',
              },
            },
          }, null, 2),
        },
      ],
    };
  }

  async getMockDataTemplatesResource() {
    return {
      contents: [
        {
          uri: 'api://mock-data/templates',
          mimeType: 'application/json',
          text: JSON.stringify({
            templates: {
              amadeus_flight: {
                structure: ['id', 'itineraries', 'price', 'travelerPricings'],
                sample_fields: {
                  id: 'flight_123',
                  price_total: '299.99',
                  price_currency: 'USD',
                },
              },
              stripe_payment: {
                structure: ['id', 'client_secret', 'amount', 'currency', 'status'],
                sample_fields: {
                  amount: 5000,
                  currency: 'usd',
                  status: 'requires_payment_method',
                },
              },
              google_place: {
                structure: ['place_id', 'name', 'rating', 'vicinity', 'types'],
                sample_fields: {
                  rating: 4.2,
                  types: ['restaurant', 'establishment'],
                },
              },
            },
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('API Testing MCP server started');
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new APITestingMCPServer();
  server.run().catch(console.error);
}

export default APITestingMCPServer;