import { renderMemoryCell } from "@/helpers";
import { useSimulator } from "@/simulator";
import { Card } from "@/ui/components/common/Card";
import { Table } from "@/ui/components/common/Table";
import { useTranslate } from "@/ui/hooks/useTranslate";

export function Handshake({ className }: { className?: string }) {
  const translate = useTranslate();

  const handshake = useSimulator(state => state.devices.handshake);

  return (
    <Card title={translate("devices.internal.handshake.name")} className={className}>
      <Table
        columns={[
          translate("devices.internal.handshake.data"),
          translate("devices.internal.handshake.state"),
        ]}
        rows={[
          {
            cells: [
              {
                content: renderMemoryCell(handshake.data, "ascii"),
                title: translate("devices.ioRegister", "DATA", 0x40),
              },
              {
                content: renderMemoryCell(handshake.state, "bin"),
                title: translate("devices.ioRegister", "STATE", 0x41),
              },
            ],
          },
        ]}
      />
    </Card>
  );
}
