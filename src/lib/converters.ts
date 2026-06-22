import type {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import type { Membership, Society, UserProfile } from '../types/auth';
import type { Account, FundHead, Vendor, VendorRelation } from '../types/config';

function makeConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    toFirestore({ id, ...rest }: T) {
      return rest;
    },
    fromFirestore(snap: QueryDocumentSnapshot, options?: SnapshotOptions): T {
      return { id: snap.id, ...snap.data(options) } as T;
    },
  };
}

export const membershipConverter    = makeConverter<Membership>();
export const societyConverter       = makeConverter<Society>();
export const userProfileConverter   = makeConverter<UserProfile>();
export const accountConverter       = makeConverter<Account>();
export const fundHeadConverter      = makeConverter<FundHead>();
export const vendorConverter        = makeConverter<Vendor>();
export const vendorRelationConverter = makeConverter<VendorRelation>();
