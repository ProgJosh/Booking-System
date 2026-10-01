import type { TravelData, Property, Reservation } from "../lib/travel";
import { dateKey, addDays } from "../lib/date";
export function travelSeed(now = new Date()): TravelData {
  const properties: Property[] = [
    {
      id: "palawan",
      name: "The Cove at El Nido",
      destination: "El Nido, Palawan",
      kind: "Island",
      description:
        "Barefoot mornings, limestone horizons, and a little space to slow down. This intimate island-inspired retreat pairs airy rooms with quiet corners beside the water.",
      image: "/images/island.jpg",
      gallery: ["/images/island.jpg", "/images/room.jpg", "/images/pool.jpg"],
      amenities: [
        "Beach access",
        "Infinity pool",
        "Breakfast included",
        "Wi-Fi",
        "Airport transfer",
      ],
      address: "Sample location · Bacuit Bay, El Nido, Palawan",
      rating: 4.9,
      active: true,
      managerIds: ["staff-1", "staff-emmanuel"],
      policy:
        "Check-in from 2 PM; check-out by 11 AM. Request cancellation before check-in. Demo reservations do not secure a real room.",
    },
    {
      id: "siargao",
      name: "Palmhouse Siargao",
      destination: "General Luna, Siargao",
      kind: "Coast",
      description:
        "A laid-back coastal hideaway among palms. Wake to warm sea air, share a long breakfast, and spend the afternoon exploring the island at your own pace.",
      image: "/images/coast.jpg",
      gallery: ["/images/coast.jpg", "/images/room.jpg", "/images/pool.jpg"],
      amenities: ["Pool", "Surf access", "Garden café", "Wi-Fi", "Bike rental"],
      address: "Sample location · General Luna, Siargao",
      rating: 4.8,
      active: true,
      managerIds: ["staff-2", "staff-emmanuel"],
      policy:
        "Check-in from 2 PM; check-out by 11 AM. Quiet hours from 10 PM. Request cancellation before check-in. Demo collection only.",
    },
    {
      id: "benguet",
      name: "Fern & Pine Lodge",
      destination: "Benguet, Cordillera",
      kind: "Forest",
      description:
        "Cool mountain air and windows opening onto green. A timber-and-stone retreat for long walks, good coffee, and evenings by the fire.",
      image: "/images/forest.jpg",
      gallery: ["/images/forest.jpg", "/images/room.jpg", "/images/dining.jpg"],
      amenities: [
        "Mountain views",
        "Fireplace lounge",
        "Breakfast included",
        "Wi-Fi",
        "Nature trails",
      ],
      address: "Sample location · Tublay, Benguet",
      rating: 4.9,
      active: true,
      managerIds: ["staff-3", "staff-emmanuel"],
      policy:
        "Check-in from 2 PM; check-out by 11 AM. Bring a warm layer. Request cancellation before check-in. Demo collection only.",
    },
    {
      id: "bohol",
      name: "Sandbar House",
      destination: "Panglao, Bohol",
      kind: "Coast",
      description:
        "A sun-drenched island stay with soft sand nearby and a pool tucked into tropical gardens. Come for the coast; stay for the unhurried rhythm.",
      image: "/images/pool.jpg",
      gallery: ["/images/pool.jpg", "/images/coast.jpg", "/images/room.jpg"],
      amenities: [
        "Garden pool",
        "Beach shuttle",
        "Restaurant",
        "Wi-Fi",
        "Family rooms",
      ],
      address: "Sample location · Panglao, Bohol",
      rating: 4.7,
      active: true,
      managerIds: ["staff-4", "staff-emmanuel"],
      policy:
        "Check-in from 2 PM; check-out by 11 AM. Children count toward room capacity. Request cancellation before check-in. Demo collection only.",
    },
  ];
  const rooms = properties.flatMap((p, i) => [
    {
      id: p.id + "-garden",
      propertyId: p.id,
      name: "Garden King",
      description:
        "A light-filled room with a king bed, private terrace, and natural textures.",
      image: "/images/room.jpg",
      price: [5800, 4600, 3900, 4200][i],
      capacity: 2,
      inventory: 4,
      active: true,
      blockedDates: [],
      amenities: [
        "King bed",
        "Private terrace",
        "Rain shower",
        "Air conditioning",
      ],
    },
    {
      id: p.id + "-suite",
      propertyId: p.id,
      name: "Family Terrace Suite",
      description:
        "Room to settle in, with two queen beds and a generous lounge for shared island days.",
      image: "/images/room.jpg",
      price: [9200, 7200, 6500, 6800][i],
      capacity: 4,
      inventory: 2,
      active: true,
      blockedDates: [],
      amenities: ["Two queen beds", "Lounge", "Private terrace", "Breakfast"],
    },
  ]);
  const experiences = properties.flatMap((p) => [
    {
      id: p.id + "-journey",
      propertyId: p.id,
      name: p.kind === "Forest" ? "Guided forest walk" : "Sunset island cruise",
      description:
        p.kind === "Forest"
          ? "A gentle, locally guided morning among the pines."
          : "An easy afternoon on the water, with golden-hour views.",
      price: p.kind === "Forest" ? 1200 : 2400,
      image: p.kind === "Forest" ? "/images/forest.jpg" : "/images/island.jpg",
      active: true,
    },
    {
      id: p.id + "-table",
      propertyId: p.id,
      name: "A taste of the islands",
      description:
        "A private tasting of regional recipes, prepared with seasonal ingredients.",
      price: 1800,
      image: "/images/dining.jpg",
      active: true,
    },
  ]);
  const today = dateKey(now),
    reservations: Reservation[] = [];
  for (let i = 0; i < 12; i++) {
    const room = rooms[i % rooms.length],
      p = properties.find((p) => p.id === room.propertyId)!,
      checkIn = addDays(today, i < 5 ? -14 + i * 2 : 2 + (i - 5) * 3),
      checkOut = addDays(checkIn, 2);
    reservations.push({
      id: "AT-DEMO" + (101 + i),
      customerId: "customer-" + ((i % 4) + 1),
      propertyId: p.id,
      roomId: room.id,
      propertyName: p.name,
      roomName: room.name,
      checkIn,
      checkOut,
      guests: 2,
      guestName: [
        "Emmanuel Josh Velo",
        "Liam Anderson",
        "Isabella Martinez",
        "Noah Williams",
      ][i % 4],
      email: "guest" + i + "@example.com",
      phone: "+63 917 000 0000",
      nightlyRate: room.price,
      nights: 2,
      subtotal: room.price * 2,
      discount: 0,
      total: room.price * 2,
      promotionCode: "",
      experienceIds: [],
      experiences: [],
      status: i < 5 ? "Completed" : i % 3 === 0 ? "Pending" : "Confirmed",
      paymentMethod: "GCash",
      notes: "Sample reservation for exploring the demo.",
      createdAt: now.toISOString(),
    });
  }
  return {
    properties,
    rooms,
    experiences,
    promotions: [
      {
        id: "slow",
        code: "SLOWDAYS",
        title: "A little longer. A little less.",
        description:
          "Save 10% on your room total. Make room for another slow morning.",
        percent: 10,
        endDate: addDays(today, 90),
        active: true,
      },
    ],
    reservations,
    events: [],
  };
}
