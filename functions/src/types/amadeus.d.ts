/**
 * Type declarations for the Amadeus API client
 */
declare module "amadeus" {
  /**
   * Main Amadeus API client class
   */
  export default class Amadeus {
    /**
     * Creates an instance of Amadeus client
     * @param options Configuration options for the client
     * @param options.clientId The Amadeus API client ID
     * @param options.clientSecret The Amadeus API client secret
     */
    constructor(options: { clientId: string; clientSecret: string });

    /**
     * Shopping API endpoints
     */
    shopping: {
      flightOffersSearch: {
        get(params: Record<string, unknown>): Promise<{ data: unknown[] }>;
      };
      hotelOffersSearch: {
        get(params: Record<string, unknown>): Promise<{ data: unknown[] }>;
      };
      flightOffers: {
        pricing: {
          post(data: { data: unknown }): Promise<{ data: unknown }>;
        };
      };
    };

    /**
     * Booking API endpoints
     */
    booking: {
      flightOrders: {
        post(data: { data: unknown }): Promise<{ data: unknown }>;
      };
    };
  }
}
