import { ENTITY } from "../domain/labels";
import type { EntityId } from "../domain/types";
import { CompanyAccounts, CompanyOutlook, CompanyRecurring } from "../ui/CompanyOps";
import { MoveForm } from "../ui/MoveForm";
import { PageHeader } from "../ui/Page";

export function Empresa({ entity }: { entity: Extract<EntityId, "picasso" | "ph"> }) {
  const meta = ENTITY[entity];

  return (
    <div className="page">
      <PageHeader title={meta.short} mark={meta.tone}>
        {meta.lede}
      </PageHeader>
      <div className="mt-8">
        <MoveForm defaultEntity={entity} />
      </div>

      <CompanyOutlook entity={entity} />
      <CompanyRecurring entity={entity} />
      <CompanyAccounts entity={entity} />
    </div>
  );
}
