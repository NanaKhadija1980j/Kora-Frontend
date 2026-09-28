import { usePositionListingStore } from '../positionListingStore';

const OWNER = '0xowner';
const OTHER = '0xother';

const makeListing = (overrides: Record<string, unknown> = {}) => ({
  id: 'listing-1',
  invoiceToken: 'token-1',
  owner: OWNER,
  price: '100',
  amount: '10',
  listedAt: 1000,
  ...overrides,
});

describe('positionListingStore', () => {
  beforeEach(() => {
    usePositionListingStore.setState({ listings: [] });
  });

  describe('listPosition', () => {
    it('adds a new listing', () => {
      usePositionListingStore.getState().listPosition(makeListing());

      const { listings } = usePositionListingStore.getState();
      expect(listings).toHaveLength(1);
      expect(listings[0]).toMatchObject({
        id: 'listing-1',
        invoiceToken: 'token-1',
        owner: OWNER,
        price: '100',
        amount: '10',
      });
    });

    it('preserves listedAt when re-listing an existing position', () => {
      usePositionListingStore.getState().listPosition(makeListing({ listedAt: 1000 }));
      usePositionListingStore
        .getState()
        .listPosition(makeListing({ price: '250', listedAt: 9999 }));

      const { listings } = usePositionListingStore.getState();
      expect(listings).toHaveLength(1);
      expect(listings[0].price).toBe('250');
      expect(listings[0].listedAt).toBe(1000);
    });
  });

  describe('unlistPosition', () => {
    it('removes the matching listing', () => {
      usePositionListingStore.getState().listPosition(makeListing());
      usePositionListingStore.getState().unlistPosition('listing-1');

      expect(usePositionListingStore.getState().listings).toHaveLength(0);
    });

    it('leaves other listings untouched', () => {
      usePositionListingStore.getState().listPosition(makeListing({ id: 'a' }));
      usePositionListingStore.getState().listPosition(makeListing({ id: 'b' }));
      usePositionListingStore.getState().unlistPosition('a');

      const { listings } = usePositionListingStore.getState();
      expect(listings).toHaveLength(1);
      expect(listings[0].id).toBe('b');
    });
  });

  describe('reconcileListings', () => {
    it('removes listings not owned by the current owner', () => {
      usePositionListingStore.getState().listPosition(makeListing({ id: 'mine', owner: OWNER }));
      usePositionListingStore.getState().listPosition(makeListing({ id: 'theirs', owner: OTHER }));

      usePositionListingStore.getState().reconcileListings(OWNER);

      const { listings } = usePositionListingStore.getState();
      expect(listings).toHaveLength(1);
      expect(listings[0].id).toBe('mine');
    });

    it('keeps all listings when all are owned', () => {
      usePositionListingStore.getState().listPosition(makeListing({ id: 'a', owner: OWNER }));
      usePositionListingStore.getState().listPosition(makeListing({ id: 'b', owner: OWNER }));

      usePositionListingStore.getState().reconcileListings(OWNER);

      expect(usePositionListingStore.getState().listings).toHaveLength(2);
    });
  });

  describe('removeStale', () => {
    it('removes listings older than the given timestamp', () => {
      usePositionListingStore.getState().listPosition(makeListing({ id: 'old', listedAt: 100 }));
      usePositionListingStore.getState().listPosition(makeListing({ id: 'new', listedAt: 5000 }));

      usePositionListingStore.getState().removeStale(1000);

      const { listings } = usePositionListingStore.getState();
      expect(listings).toHaveLength(1);
      expect(listings[0].id).toBe('new');
    });
  });

  describe('getListingsByInvoiceToken', () => {
    it('returns only listings for the given invoice token', () => {
      usePositionListingStore.getState().listPosition(makeListing({ id: 'a', invoiceToken: 'token-1' }));
      usePositionListingStore.getState().listPosition(makeListing({ id: 'b', invoiceToken: 'token-2' }));

      const result = usePositionListingStore.getState().getListingsByInvoiceToken('token-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });
  });

  describe('persist round-trip', () => {
    it('rehydrates listings from persisted state', () => {
      const listing = makeListing();
      usePositionListingStore.getState().listPosition(listing);

      const persisted = usePositionListingStore.getState().listings;
      usePositionListingStore.setState({ listings: [] });
      usePositionListingStore.setState({ listings: persisted });

      expect(usePositionListingStore.getState().listings).toEqual(persisted);
    });
  });
});
