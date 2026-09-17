export type MemberRole =
  | "OWNER"
  | "ADMIN_KEUANGAN"
  | "STAF_INPUT"
  | "MANAJER_PROJECT";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export type ActiveMembership = {
  membershipId: string;
  orgId: string;
  orgName: string;
  companyCode: string;
  role: MemberRole;
};

export const COMPANY_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;
