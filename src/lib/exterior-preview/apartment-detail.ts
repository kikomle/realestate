export type ApartmentPlanMedia = { src: string; width: number; height: number };

export type ApartmentDetails = {
  id: string;
  type: string;
  listingArea: string;
  status: { label: "Slobodno" | "Prodano"; date: string } | null;
  source: string;
  inquiry: string | null;
  pdf: string | null;
  plan: ApartmentPlanMedia | null;
  detailNP: number;
  sheet: {
    np_total_m2: number;
    nkp_total_m2: number;
    rooms: readonly {
      number: string;
      label: string;
      np_m2: number;
      coefficient: number;
      nkp_m2: number;
    }[];
  } | null;
  differences: { np: boolean; nkp: boolean };
};

const area = new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatPlanNumber = (value: number) => area.format(value);
