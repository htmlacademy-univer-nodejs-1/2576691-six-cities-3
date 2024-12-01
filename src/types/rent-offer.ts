export type RentOffer = {
    title: string;
    description: string;
    city: string;
    previewImage: string;
    photos: string[];
    isPremium: boolean;
    rating: number;
    type: 'apartment' | 'house' | 'room' | 'hotel';
    rooms: number;
    guests: number;
    price: number;
    features: string[];
    author: {
      name: string;
      email: string;
      avatarUrl: string;
      isPro: boolean;
    };
    location: {
      latitude: number;
      longitude: number;
    };
  };