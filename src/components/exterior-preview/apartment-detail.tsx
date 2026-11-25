import { ArrowUpRight, FileText, Mail } from "lucide-react";
import type { Ref } from "react";
import { formatPlanNumber, type ApartmentDetails } from "@/lib/exterior-preview/apartment-detail";
import { ApartmentPlanView } from "./apartment-plan-view";
import styles from "./apartment-detail.module.css";

function Schedule({ unit }: { unit: ApartmentDetails }) {
  const sheet = unit.sheet;
  if (!sheet) return <p>Iskaz površina nije dostupan.</p>;
  return (
    <>
      <table className={styles.schedule}>
        <caption className="sr-only">Površine i koeficijenti iz izvorne PDF tablice</caption>
        <thead>
          <tr><th scope="col">Br.</th><th scope="col">Prostor</th><th scope="col">NP (m²)</th><th scope="col">K</th><th scope="col">NKP (m²)</th></tr>
        </thead>
        <tbody>
          {sheet.rooms.map((room, i) => (
            <tr key={`${room.number}-${i}`}>
              <td>{room.number}</td><th scope="row">{room.label}</th><td>{formatPlanNumber(room.np_m2)}</td>
              <td>{formatPlanNumber(room.coefficient)}</td><td>{formatPlanNumber(room.nkp_m2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th scope="row" colSpan={2}>Ukupno prema PDF-u</th><td>{formatPlanNumber(sheet.np_total_m2)}</td>
            <td>—</td><td>{formatPlanNumber(sheet.nkp_total_m2)}</td></tr>
        </tfoot>
      </table>
      <p className={styles.finePrint}>NP, K (koeficijent) i NKP preuzeti su iz PDF-a. Ukupni iznosi uključuju navedene vanjske prostore.</p>
      {unit.differences.np && (
        <p className={styles.note}>NP u oglasu iznosi {formatPlanNumber(unit.detailNP)} m², a u PDF-u {formatPlanNumber(sheet.np_total_m2)} m².</p>
      )}
      {unit.differences.nkp && (
        <p className={styles.note}>Obračunska površina u oglasu iznosi {unit.listingArea} m², a NKP u PDF-u {formatPlanNumber(sheet.nkp_total_m2)} m².</p>
      )}
    </>
  );
}

export function ApartmentDetail({ unit, floor, exteriorUrl, exteriorLabel, headingRef, pending, planFootprintPx2, floorFootprintMaxPx2 }: {
  unit: ApartmentDetails;
  floor: string;
  exteriorUrl: string;
  exteriorLabel: string;
  headingRef: Ref<HTMLHeadingElement>;
  pending: boolean;
  planFootprintPx2?: number | null;
  floorFootprintMaxPx2?: number | null;
}) {
  return (
    <article className={styles.detail} aria-labelledby="apartment-title" data-apartment-detail hidden={pending}>
      <header className={styles.summary}>
        <p className={styles.floor} data-unit-floor>{floor}</p>
        <h1 id="apartment-title" tabIndex={-1} ref={headingRef}>{unit.id}</h1>
        <p className={styles.type} data-unit-type>{unit.type}</p>
        <dl className={styles.area}>
          <dt>Obračunska površina</dt>
          <dd data-listing-area>{unit.listingArea} m²</dd>
        </dl>
        {planFootprintPx2 != null && (
          <dl className={styles.area} data-plan-footprint>
            <dt>Prikaz na tlocrtu etaže (slikovni otisak)</dt>
            <dd>{new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 0 }).format(Math.round(planFootprintPx2))} px²
              {floorFootprintMaxPx2 && floorFootprintMaxPx2 > 0 && (
                <span> · {Math.round((planFootprintPx2 / floorFootprintMaxPx2) * 100)} % najvećeg stana na etaži</span>
              )}
            </dd>
            <dd className={styles.finePrint}>Samo slikovni otisak na izvornom nacrtu; nije mjera ni procjena stvarne površine.</dd>
          </dl>
        )}
        {unit.status && (
          <div className={styles.availability}>
            <span className={styles.status} data-source-status data-available={unit.status.label === "Slobodno"}>{unit.status.label}</span>
            <p>Prema <a href={unit.source} target="_blank" rel="noreferrer">Sigmi</a>, <time dateTime={unit.status.date}>
              {unit.status.date.split("-").reverse().map(Number).join(". ")}.
            </time> Nije prikaz uživo.</p>
          </div>
        )}
      </header>

      <section className={styles.viewer} aria-labelledby="apartment-plan-title">
        <div className={styles.planHeading}>
          <h2 id="apartment-plan-title">Tlocrt stana</h2>
          <p>Izvorni nacrt · Sigma</p>
        </div>
        {unit.plan ? <ApartmentPlanView plan={unit.plan} unitId={unit.id} /> : (
          <p className={styles.planMessage} role="status">Pojedinačni tlocrt nije dostupan.</p>
        )}
      </section>

      <div className={styles.actions}>
        {unit.inquiry && <>
          <a className={styles.inquiry} href={unit.inquiry} target="_blank" rel="noreferrer">
            <Mail aria-hidden="true" /> Pošalji upit za stan <ArrowUpRight aria-hidden="true" />
          </a>
          <p>U upitu Sigmi navedite oznaku {unit.id}.</p>
        </>}
        {unit.pdf && <div className={styles.documents}>
          <a href={unit.pdf} target="_blank" rel="noreferrer"><FileText aria-hidden="true" /> Otvori izvorni PDF</a>
          <a href={unit.source} target="_blank" rel="noreferrer">Preuzimanje na Sigmi <ArrowUpRight aria-hidden="true" /></a>
        </div>}
      </div>

      <section className={styles.rooms} aria-labelledby="room-title">
        <h2 id="room-title">Prostori i površine</h2>
        <Schedule unit={unit} />
      </section>

      <a className={styles.context} href={exteriorUrl}>
        <span>{exteriorLabel} <ArrowUpRight aria-hidden="true" /></span>
      </a>
    </article>
  );
}
