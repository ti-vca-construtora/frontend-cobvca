import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export interface GroupableChargeItem {
  id: string;
  bill_id: string;
  client_name: string | null;
  document: string | null;
  enterprise_name: string | null;
  due_date: string | null;
  amount: number | null;
  legal_process_flag?: boolean;
  internal_handling_flag?: boolean;
}

interface Props {
  items: GroupableChargeItem[];
  legalDocsSet?: Set<string>;
  internalDocsSet?: Set<string>;
  onItemClick?: (item: GroupableChargeItem) => void;
}

export interface ClientItemGroup {
  key: string;
  billId: string;
  clientName: string;
  document: string;
  enterpriseName: string;
  totalAmount: number;
  items: GroupableChargeItem[];
  hasLegal: boolean;
  hasInternal: boolean;
}

function normalizeDoc(value: string) {
  return value.replace(/\D/g, "");
}

export function groupTitleItems(
  items: GroupableChargeItem[],
  legalDocsSet?: Set<string>,
  internalDocsSet?: Set<string>,
) {
  const groups = new Map<string, ClientItemGroup>();

  for (const item of items) {
    const billId = item.bill_id ?? "Sem titulo";
    const clientName = item.client_name ?? "Sem cliente";
    const document = item.document ?? "sem documento";
    const enterpriseName = item.enterprise_name ?? "—";
    const normalizedDoc = item.document ? normalizeDoc(item.document) : "";
    const itemLegal = !!item.legal_process_flag || (!!normalizedDoc && !!legalDocsSet?.has(normalizedDoc));
    const itemInternal = !!item.internal_handling_flag || (!!normalizedDoc && !!internalDocsSet?.has(normalizedDoc));
    const key = `${billId}||${enterpriseName}||${clientName}||${document}`;
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        key,
        billId,
        clientName,
        document,
        enterpriseName,
        totalAmount: item.amount ?? 0,
        items: [item],
        hasLegal: itemLegal,
        hasInternal: itemInternal,
      });
    } else {
      current.items.push(item);
      current.totalAmount += item.amount ?? 0;
      current.hasLegal = current.hasLegal || itemLegal;
      current.hasInternal = current.hasInternal || itemInternal;
    }
  }

  return Array.from(groups.values());
}

export function ClientGroupedItems({ items, legalDocsSet, internalDocsSet, onItemClick }: Props) {
  const grouped = groupTitleItems(items, legalDocsSet, internalDocsSet);

  return (
    <div className="rounded-md border text-sm max-h-[360px] overflow-y-auto">
      <Accordion type="multiple" className="w-full">
        {grouped.map((group) => (
          <AccordionItem key={group.key} value={group.key} className="px-3">
            <AccordionTrigger className="py-3">
              <div className={`flex w-full items-start justify-between gap-4 text-left ${group.hasLegal ? "text-red-700" : ""}`}>
                <div className="min-w-0">
                  <p className="font-medium truncate">Titulo: {group.billId}</p>
                  <p className="text-muted-foreground text-xs truncate">Cliente: {group.clientName}</p>
                  <p className="text-muted-foreground text-xs truncate">Documento: {group.document}</p>
                  <p className="text-muted-foreground text-xs truncate">Empreendimento: {group.enterpriseName}</p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-xs text-muted-foreground">{group.items.length} parcela(s)</p>
                  <p className="font-medium text-xs">
                    {group.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  {(group.hasLegal || group.hasInternal) && (
                    <div className="flex justify-end gap-1">
                      {group.hasLegal && <Badge variant="outline" className="text-xs px-1">JUR</Badge>}
                      {group.hasInternal && <Badge variant="destructive" className="text-xs px-1">TI</Badge>}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="mb-2 rounded-md border divide-y">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between px-2 py-2 gap-3 ${onItemClick ? "cursor-pointer hover:bg-muted/40" : ""}`}
                    onClick={() => onItemClick?.(item)}
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">Parcela do titulo: {group.billId}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.due_date ? new Date(item.due_date).toLocaleDateString("pt-BR") : "Sem vencimento"}
                      </p>
                    </div>
                    <p className="font-medium text-xs shrink-0">
                      {item.amount != null
                        ? item.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                        : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
