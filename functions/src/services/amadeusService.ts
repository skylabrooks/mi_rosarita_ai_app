import Amadeus from "amadeus";
import {logger} from "firebase-functions";

export interface FlightSearchParams {
  originLocationCode: string;
  destinationLocationCode: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children?: number;
  infants?: number;
  travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  nonStop?: boolean;
  currencyCode?: string;
}

export interface HotelSearchParams {
  cityCode: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  rooms?: number;
  currency?: string;
  radius?: number;
  radiusUnit?: "KM" | "MILE";
  hotelName?: string;
  amenities?: string[];
}

export interface FlightOffer {
  id: string;
  price: {
    total: string;
    currency: string;
    base: string;
    taxes: string[];
  };
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: {
        iataCode: string;
        terminal?: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        terminal?: string;
        at: string;
      };
      carrierCode: string;
      number: string;
      aircraft: {
        code: string;
      };
      operating: {
        carrierCode: string;
      };
      duration: string;
      id: string;
    }>;
  }>;
  travelerPricings: Array<{
    travelerId: string;
    fareOption: string;
    travelerType: string;
    price: {
      total: string;
      base: string;
    };
    fareDetailsBySegment: Array<{
      segmentId: string;
      cabin: string;
      fareBasis: string;
      class: string;
      includedCheckedBags: {
        quantity: number;
      };
    }>;
  }>;
}

export interface HotelOffer {
  hotel: {
    hotelId: string;
    name: string;
    address: {
      lines: string[];
      postalCode: string;
      cityName: string;
      countryCode: string;
    };
    rating?: string;
    amenities?: string[];
    distance?: {
      value: number;
      unit: string;
    };
    chainCode: string;
    iataCode: string;
    lastUpdate: string;
  };
  offers: Array<{
    id: string;
    checkInDate: string;
    checkOutDate: string;
    room: {
      type: string;
      typeEstimated: {
        category: string;
        beds: number;
        bedType: string;
      };
      description: {
        text: string;
        lang: string;
      };
    };
    guests: {
      adults: number;
    };
    price: {
      currency: string;
      base: string;
      total: string;
      variations: {
        average: {
          base: string;
        };
        changes: Array<{
          startDate: string;
          endDate: string;
          base: string;
        }>;
      };
    };
    policies: {
      holdTime: {
        deadline: string;
      };
      guarantee: {
        acceptedPayments: {
          creditCards: string[];
          methods: string[];
        };
      };
      cancellation: {
        deadline: string;
      };
    };
    self: string;
  }>;
}

/**
 * Service for interacting with the Amadeus Travel API
 */
export class AmadeusService {
  private amadeus: Amadeus;

  /**
   * Creates an instance of AmadeusService
   * @param {string} apiKey The Amadeus API key
   * @param {string} apiSecret The Amadeus API secret
   */
  constructor(apiKey: string, apiSecret: string) {
    this.amadeus = new Amadeus({
      clientId: apiKey,
      clientSecret: apiSecret,
    });
  }

  /**
   * Searches for flight offers using Amadeus API
   * @param {FlightSearchParams} params Flight search parameters
   * @return {Promise<FlightOffer[]>} Array of flight offers
   */
  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    try {
      logger.info("Searching flights with params:", params);

      const response = await this.amadeus.shopping.flightOffersSearch.get({
        originLocationCode: params.originLocationCode,
        destinationLocationCode: params.destinationLocationCode,
        departureDate: params.departureDate,
        returnDate: params.returnDate,
        adults: params.adults,
        children: params.children,
        infants: params.infants,
        travelClass: params.travelClass,
        nonStop: params.nonStop,
        currencyCode: params.currencyCode || "USD",
        max: 10,
      });

      if (!response.data || response.data.length === 0) {
        logger.warn("No flights found for search parameters");
        return [];
      }

      return response.data as FlightOffer[];
    } catch (error) {
      logger.error("Error searching flights:", error);
      throw new Error(`Failed to search flights: ${(error as Error).message}`);
    }
  }

  /**
   * Searches for hotel offers using Amadeus API
   * @param {HotelSearchParams} params Hotel search parameters
   * @return {Promise<HotelOffer[]>} Array of hotel offers
   */
  async searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
    try {
      logger.info("Searching hotels with params:", params);

      const response = await this.amadeus.shopping.hotelOffersSearch.get({
        cityCode: params.cityCode,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        adults: params.adults,
        roomQuantity: params.rooms || 1,
        currency: params.currency || "USD",
        radius: params.radius,
        radiusUnit: params.radiusUnit,
        hotelName: params.hotelName,
        amenities: params.amenities?.join(","),
        max: 10,
      });

      if (!response.data || response.data.length === 0) {
        logger.warn("No hotels found for search parameters");
        return [];
      }

      return response.data as HotelOffer[];
    } catch (error) {
      logger.error("Error searching hotels:", error);
      throw new Error(`Failed to search hotels: ${(error as Error).message}`);
    }
  }

  /**
   * Gets pricing information for a flight offer
   * @param {string} flightOfferId The ID of the flight offer
   * @return {Promise<object>} Pricing information for the flight offer
   */
  async getFlightPrice(flightOfferId: string): Promise<{
    type: string;
    flightOffers: Array<{
      type: string;
      id: string;
      price: {
        total: string;
        base: string;
        currency: string;
      };
    }>;
  }> {
    try {
      logger.info("Getting flight price for offer:", flightOfferId);

      const response = await this.amadeus.shopping.flightOffers.pricing.post({
        data: {
          type: "flight-offers-pricing",
          flightOffers: [
            {
              id: flightOfferId,
            },
          ],
        },
      });

      return response.data as {
        type: string;
        flightOffers: Array<{
          type: string;
          id: string;
          price: {
            total: string;
            base: string;
            currency: string;
          };
        }>;
      };
    } catch (error) {
      logger.error("Error getting flight price:", error);
      throw new Error(
        `Failed to get flight price: ${(error as Error).message}`
      );
    }
  }

  /**
   * Books a flight using Amadeus API
   * @param {string} flightOfferId The ID of the flight offer to book
   * @param {Array<object>} travelers Array of traveler information
   * @return {Promise<object>} Flight booking confirmation
   */
  async bookFlight(flightOfferId: string, travelers: Array<{
    id: string;
    dateOfBirth: string;
    name: {
      firstName: string;
      lastName: string;
    };
    gender: "MALE" | "FEMALE";
    contact: {
      emailAddress: string;
      phones: Array<{
        deviceType: string;
        countryCallingCode: string;
        number: string;
      }>;
    };
    documents: Array<{
      documentType: string;
      birthPlace: string;
      issuanceLocation: string;
      issuanceDate: string;
      number: string;
      expiryDate: string;
      issuanceCountry: string;
      validityCountry: string;
      nationality: string;
      holder: boolean;
    }>;
  }>): Promise<{
    type: string;
    id: string;
    flightOffers: Array<{
      type: string;
      id: string;
      price: {
        total: string;
        base: string;
        currency: string;
      };
    }>;
    travelers: Array<{
      type: string;
      id: string;
      dateOfBirth: string;
      gender: string;
      name: {
        firstName: string;
        lastName: string;
      };
    }>;
  }> {
    try {
      logger.info("Booking flight for offer:", flightOfferId);

      const response = await this.amadeus.booking.flightOrders.post({
        data: {
          type: "flight-order",
          flightOffers: [
            {
              id: flightOfferId,
            },
          ],
          travelers: travelers,
        },
      });

      return response.data as {
        type: string;
        id: string;
        flightOffers: Array<{
          type: string;
          id: string;
          price: {
            total: string;
            base: string;
            currency: string;
          };
        }>;
        travelers: Array<{
          type: string;
          id: string;
          dateOfBirth: string;
          gender: string;
          name: {
            firstName: string;
            lastName: string;
          };
        }>;
      };
    } catch (error) {
      logger.error("Error booking flight:", error);
      throw new Error(`Failed to book flight: ${(error as Error).message}`);
    }
  }
}
