import { PropertyType, ConditionRating, Room, InspectionItem } from '../types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const defaultItemNames: Record<string, string[]> = {
  walls: ['Paint Condition', 'Wall Cracks', 'Holes / Marks', 'Moisture / Dampness', 'Wallpaper / Wall Covering'],
  ceiling: ['Paint Condition', 'Cracks', 'Water Stains / Leaks', 'Light Fixtures', 'Ceiling Fan'],
  floor: ['Tile / Marble Condition', 'Carpet Condition', 'Grout Lines', 'Scratches / Stains', 'Level / Evenness'],
  doors: ['Main Door', 'Room Doors', 'Door Frames', 'Handles / Knobs', 'Locks / Deadbolts', 'Door Closers'],
  windows: ['Glass Condition', 'Window Frames', 'Handles / Latches', 'Seals / Gaskets', 'Curtains / Blinds', 'Screens'],
  kitchen: ['Countertop', 'Cabinets / Drawers', 'Sink / Faucet', 'Dishwasher', 'Stove / Oven', 'Extractor Hood', 'Refrigerator', 'Backsplash'],
  bathroom: ['Toilet', 'Sink / Vanity', 'Bathtub / Shower', 'Faucets / Taps', 'Tiles / Grout', 'Exhaust Fan', 'Mirror', 'Towel Rails'],
  fixtures: ['Light Switches', 'Power Sockets', 'Light Fixtures', 'AC Vents', 'Smoke Detectors', 'Intercom'],
  ac: ['AC Unit(s)', 'Thermostat', 'Vents / Ducts', 'Remote Control', 'Filter Condition'],
  plumbing: ['Water Pressure', 'Hot Water', 'Drainage', 'Pipe Condition', 'Water Heater'],
  appliances: ['Washing Machine', 'Dryer', 'Water Purifier', 'Built-in Appliances'],
  outdoor: ['Garden / Landscaping', 'Fence / Gate', 'Exterior Walls', 'Driveway', 'Pool Condition', 'Outdoor Lighting'],
  parking: ['Parking Space', 'Garage Door', 'Parking Lighting', 'Storage Area'],
  reception: ['Front Desk', 'Waiting Area', 'Signage', 'Visitor Log Area'],
  office_area: ['Workstations', 'Partitions', 'Power/Data Points', 'Lighting', 'Flooring'],
  meeting_room: ['Table', 'Chairs', 'AV Equipment', 'Whiteboard', 'Acoustics'],
};

function createItems(names: string[], category: string) {
  return names.map(name => ({
    id: '',
    name,
    category,
    condition: null as ConditionRating | null,
    comments: '',
    photos: [] as any[],
    checked: false,
  }));
}

function createGeneralItem(): InspectionItem {
  return {
    id: 'general',
    name: 'General',
    category: 'general',
    condition: null,
    comments: '',
    photos: [],
    checked: false,
  };
}

function createKeysItem(): InspectionItem {
  return {
    id: 'keys_access_cards',
    name: 'Keys & Access Cards',
    category: 'access',
    condition: null,
    comments: '',
    photos: [],
    checked: false,
  };
}

function createUtilityItem(): InspectionItem {
  return {
    id: 'utility_meters',
    name: 'Utility Meters Reading',
    category: 'utility',
    condition: null,
    comments: '',
    photos: [],
    checked: false,
  };
}

function withGeneralItem(items: InspectionItem[]): InspectionItem[] {
  const general = items.find(i => i.name === 'General' || i.id === 'general');
  const rest = items.filter(i => i.name !== 'General' && i.id !== 'general');
  return [general || createGeneralItem(), ...rest];
}

// Room templates for each property type (excluding bedrooms/bathrooms which are dynamic)
const baseRooms: Record<PropertyType, Omit<Room, 'id'>[]> = {
  apartment: [
    {
      name: 'Entrance / Foyer',
      type: 'entrance',
      icon: '🚪',
      items: withGeneralItem(createItems([...defaultItemNames.doors.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 3), ...defaultItemNames.floor.slice(0, 3)], 'entrance')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Living Room',
      type: 'living_room',
      icon: '🛋️',
      items: withGeneralItem(createItems([...defaultItemNames.walls, ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 4), ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'living_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Kitchen',
      type: 'kitchen',
      icon: '🍳',
      items: withGeneralItem(createItems([...defaultItemNames.kitchen, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.plumbing, ...defaultItemNames.fixtures.slice(0, 3)], 'kitchen')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Balcony',
      type: 'balcony',
      icon: '🌅',
      items: withGeneralItem(createItems(['Flooring', 'Railing / Balustrade', 'Drainage', 'Door / Access', 'Walls / Ceiling', 'Lighting', 'View / Surroundings'], 'balcony')),
      overallComments: '',
      overallCondition: null,
    },
  ],
  townhouse: [
    {
      name: 'Entrance / Foyer',
      type: 'entrance',
      icon: '🚪',
      items: withGeneralItem(createItems([...defaultItemNames.doors.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 3), ...defaultItemNames.floor.slice(0, 3)], 'entrance')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Living Room',
      type: 'living_room',
      icon: '🛋️',
      items: withGeneralItem(createItems([...defaultItemNames.walls, ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 4), ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'living_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Kitchen',
      type: 'kitchen',
      icon: '🍳',
      items: withGeneralItem(createItems([...defaultItemNames.kitchen, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.plumbing, ...defaultItemNames.fixtures.slice(0, 3)], 'kitchen')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Dining Room',
      type: 'dining',
      icon: '🍽️',
      items: withGeneralItem(createItems([...defaultItemNames.walls.slice(0, 4), ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.doors.slice(1, 3)], 'dining')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Maid\'s Room',
      type: 'maids_room',
      icon: '🛏️',
      items: withGeneralItem(createItems([...defaultItemNames.walls.slice(0, 4), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.doors.slice(1, 4), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.ac.slice(0, 2)], 'maids_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Garden / Terrace',
      type: 'outdoor',
      icon: '🌿',
      items: withGeneralItem(createItems([...defaultItemNames.outdoor, ...defaultItemNames.plumbing.slice(3, 5)], 'outdoor')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Parking / Garage',
      type: 'parking',
      icon: '🚗',
      items: withGeneralItem(createItems([...defaultItemNames.parking], 'parking')),
      overallComments: '',
      overallCondition: null,
    },
  ],
  villa: [
    {
      name: 'Entrance / Foyer',
      type: 'entrance',
      icon: '🚪',
      items: withGeneralItem(createItems([...defaultItemNames.doors.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.floor.slice(0, 4)], 'entrance')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Living Room',
      type: 'living_room',
      icon: '🛋️',
      items: withGeneralItem(createItems([...defaultItemNames.walls, ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows, ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'living_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Family Room / TV Room',
      type: 'family_room',
      icon: '📺',
      items: withGeneralItem(createItems([...defaultItemNames.walls, ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 4), ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'family_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Kitchen',
      type: 'kitchen',
      icon: '🍳',
      items: withGeneralItem(createItems([...defaultItemNames.kitchen, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.plumbing, ...defaultItemNames.fixtures.slice(0, 3), ...defaultItemNames.appliances], 'kitchen')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Dining Room',
      type: 'dining',
      icon: '🍽️',
      items: withGeneralItem(createItems([...defaultItemNames.walls.slice(0, 4), ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.doors.slice(1, 3)], 'dining')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Maid\'s Room',
      type: 'maids_room',
      icon: '🛏️',
      items: withGeneralItem(createItems([...defaultItemNames.walls.slice(0, 4), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.doors.slice(1, 4), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.ac.slice(0, 2)], 'maids_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Laundry Room',
      type: 'laundry',
      icon: '🧺',
      items: withGeneralItem(createItems(['Washing Machine', 'Dryer', 'Sink', 'Shelving', 'Flooring', 'Ventilation', 'Water Heater'], 'laundry')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Garden / Yard',
      type: 'outdoor',
      icon: '🌿',
      items: withGeneralItem(createItems([...defaultItemNames.outdoor, 'Irrigation System', 'BBQ Area', 'Children\'s Play Area'], 'outdoor')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Swimming Pool',
      type: 'pool',
      icon: '🏊',
      items: withGeneralItem(createItems(['Pool Tiles', 'Water Quality', 'Pump Equipment', 'Pool Fence / Gate', 'Pool Lighting', 'Surrounding Deck'], 'pool')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Garage',
      type: 'parking',
      icon: '🚗',
      items: withGeneralItem(createItems([...defaultItemNames.parking, 'EV Charger (if applicable)', 'Storage Shelves'], 'parking')),
      overallComments: '',
      overallCondition: null,
    },
  ],
  office: [
    {
      name: 'Reception / Lobby',
      type: 'reception',
      icon: '🏛️',
      items: withGeneralItem(createItems([...defaultItemNames.reception, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.ac.slice(0, 2)], 'reception')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Open Office Area',
      type: 'office_area',
      icon: '💼',
      items: withGeneralItem(createItems([...defaultItemNames.office_area, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.ceiling.slice(0, 4), ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'office_area')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Manager\'s Cabin',
      type: 'cabin',
      icon: '🪑',
      items: withGeneralItem(createItems([...defaultItemNames.walls, ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 4), ...defaultItemNames.doors.slice(1, 5), ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'cabin')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Server / IT Room',
      type: 'server_room',
      icon: '🖥️',
      items: withGeneralItem(createItems(['Server Racks', 'Cooling System', 'Cable Management', 'UPS / Power', 'Flooring (Raised)', 'Fire Suppression', 'Access Control'], 'server_room')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Kitchen / Pantry',
      type: 'kitchen',
      icon: '☕',
      items: withGeneralItem(createItems([...defaultItemNames.kitchen.slice(0, 4), ...defaultItemNames.plumbing.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.appliances.slice(0, 2)], 'kitchen')),
      overallComments: '',
      overallCondition: null,
    },
    {
      name: 'Storage Room',
      type: 'storage',
      icon: '📦',
      items: withGeneralItem(createItems(['Shelving', 'Flooring', 'Lighting', 'Door / Lock', 'Ventilation', 'Fire Safety'], 'storage')),
      overallComments: '',
      overallCondition: null,
    },
  ],
};

function createBedroomItems(): InspectionItem[] {
  return withGeneralItem(createItems([...defaultItemNames.walls, ...defaultItemNames.ceiling, ...defaultItemNames.floor, ...defaultItemNames.windows.slice(0, 4), ...defaultItemNames.doors.slice(1, 5), ...defaultItemNames.fixtures, ...defaultItemNames.ac], 'bedroom'));
}

function createBathroomItems(): InspectionItem[] {
  return withGeneralItem(createItems([...defaultItemNames.bathroom, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.plumbing.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 3)], 'bathroom'));
}

function createMeetingRoomItems(): InspectionItem[] {
  return withGeneralItem(createItems([...defaultItemNames.meeting_room, ...defaultItemNames.walls.slice(0, 3), ...defaultItemNames.floor.slice(0, 3), ...defaultItemNames.fixtures.slice(0, 4), ...defaultItemNames.ac.slice(0, 2)], 'meeting_room'));
}

/**
 * Build the full room list for a property type based on user-specified bedroom/bathroom counts.
 * Every room gets a "General" item as the first item.
 */
export function buildRoomsForPropertyType(
  type: PropertyType,
  bedrooms: number,
  bathrooms: number,
): Omit<Room, 'id'>[] {
  const rooms: Omit<Room, 'id'>[] = [...baseRooms[type]];

  // Add bedrooms
  for (let i = 1; i <= bedrooms; i++) {
    const name = i === 1 ? 'Master Bedroom' : `Bedroom ${i}`;
    rooms.push({
      name,
      type: 'bedroom',
      icon: '🛏️',
      items: createBedroomItems(),
      overallComments: '',
      overallCondition: null,
    });
  }

  // Add bathrooms
  for (let i = 1; i <= bathrooms; i++) {
    const name = i === 1 ? 'Master Bathroom' : `Bathroom ${i}`;
    rooms.push({
      name,
      type: 'bathroom',
      icon: '🚿',
      items: createBathroomItems(),
      overallComments: '',
      overallCondition: null,
    });
  }

  return rooms;
}

/**
 * For office type: rooms = number of meeting rooms / cabins, bathrooms = restrooms
 */
export function buildRoomsForOffice(
  rooms: number,
  bathrooms: number,
): Omit<Room, 'id'>[] {
  const roomList: Omit<Room, 'id'>[] = [...baseRooms.office];

  // Add meeting rooms / cabins
  for (let i = 1; i <= rooms; i++) {
    const name = `Meeting Room ${i}`;
    roomList.push({
      name,
      type: 'meeting_room',
      icon: '🤝',
      items: createMeetingRoomItems(),
      overallComments: '',
      overallCondition: null,
    });
  }

  // Add restrooms
  for (let i = 1; i <= bathrooms; i++) {
    const name = i === 1 ? 'Restroom' : `Restroom ${i}`;
    roomList.push({
      name,
      type: 'bathroom',
      icon: '🚿',
      items: createBathroomItems(),
      overallComments: '',
      overallCondition: null,
    });
  }

  return roomList;
}

export const propertyTemplates = baseRooms;

export function getPropertyTypeLabel(type: PropertyType): string {
  switch (type) {
    case 'apartment': return 'Apartment';
    case 'townhouse': return 'Townhouse';
    case 'villa': return 'Villa';
    case 'office': return 'Office';
    default: return type;
  }
}

export function getInspectionTypeLabel(type: string): string {
  switch (type) {
    case 'move_in': return 'Move-In';
    case 'move_out': return 'Move-Out';
    case 'routine': return 'Routine';
    case 'mid_lease': return 'Mid-Lease';
    default: return type;
  }
}

export function getConditionLabel(condition: string | null): string {
  switch (condition) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
    case 'damaged': return 'Damaged';
    case 'missing': return 'Missing';
    default: return 'Not Rated';
  }
}

export function getConditionColor(condition: string | null): string {
  switch (condition) {
    case 'excellent': return 'text-emerald-600';
    case 'good': return 'text-green-600';
    case 'fair': return 'text-amber-600';
    case 'poor': return 'text-orange-600';
    case 'damaged': return 'text-red-600';
    case 'missing': return 'text-gray-600';
    default: return 'text-slate-400';
  }
}
