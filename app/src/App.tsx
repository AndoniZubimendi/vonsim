import { Tabs, TabsContent, TabsList, TabsTrigger } from "@radix-ui/react-tabs";
import { useAtom } from "jotai";
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useMedia } from "react-use";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Settings, settingsOpenAtom } from "@/components/Settings";
import { ComputerContainer } from "@/computer";
import { Editor } from "@/editor";
import { useTranslate } from "@/lib/i18n";

export default function App() {
  const translate = useTranslate();
  const isMobile = useMedia("(max-width: 640px)"); // tailwind sm breakpoint

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      toast(translate("update.update-available"), {
        action: {
          label: translate("update.reload"),
          onClick: () => updateServiceWorker(true),
        },
      });
    },
  });

  return (
    <div className="flex h-screen w-screen flex-col bg-stone-900 text-white">
      <Header />

      {isMobile ? <MobileLayout /> : <DesktopLayout />}

      <Footer />
    </div>
  );
}

function DesktopLayout() {
  const [settingsOpen] = useAtom(settingsOpenAtom);

  return (
    <PanelGroup
      autoSaveId="layout"
      tagName="main"
      direction="horizontal"
      className="overflow-auto px-2"
    >
      <Panel
        id="panel-editor"
        order={1}
        minSize={20}
        tagName="section"
        className="rounded-lg border border-stone-600 bg-stone-800"
      >
        <Editor className="h-full w-full" />
      </Panel>
      <PanelResizeHandle className="w-2" />
      <Panel
        id="panel-computer"
        order={2}
        minSize={20}
        tagName="section"
        className="computer-background rounded-lg border border-stone-600"
      >
        <ComputerContainer />
      </Panel>
      {settingsOpen && (
        <>
          <PanelResizeHandle className="w-2" />
          <Panel
            id="panel-settings"
            order={3}
            minSize={30}
            tagName="section"
            className="rounded-lg border border-stone-600 bg-stone-800"
          >
            <Settings className="h-full w-full" />
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}

function MobileLayout() {
  const translate = useTranslate();

  const [selectedTab, setSelectedTab] = useState<"editor" | "computer">("editor");
  const [settingsOpen, setSettingsOpen] = useAtom(settingsOpenAtom);

  const tab = settingsOpen ? "settings" : selectedTab;
  const setTab = (tab: string) => {
    if (settingsOpen) setSettingsOpen(false);
    setSelectedTab(tab as typeof selectedTab);
  };

  return (
    <Tabs value={tab} onValueChange={setTab} asChild>
      <>
        <TabsContent value="editor" asChild>
          <section className="mx-2 grow overflow-hidden rounded-lg border border-stone-600 bg-stone-800 data-[state=inactive]:hidden">
            <Editor className="h-full w-full" />
          </section>
        </TabsContent>
        <TabsContent value="computer" asChild>
          <section className="computer-background mx-2 grow overflow-hidden rounded-lg border border-stone-600 bg-stone-800 data-[state=inactive]:hidden">
            <ComputerContainer />
          </section>
        </TabsContent>
        <TabsContent value="settings" asChild>
          <section className="mx-2 grow overflow-hidden rounded-lg border border-stone-600 bg-stone-800 data-[state=inactive]:hidden">
            <Settings className="h-full w-full" />
          </section>
        </TabsContent>

        <TabsList className="grid grid-cols-2 gap-2 p-2">
          <TabsTrigger
            value="editor"
            className="inline-flex items-center justify-center rounded-lg py-2 text-sm font-semibold leading-none text-stone-400 transition-colors hover:bg-stone-800 hover:text-white data-[state=active]:bg-stone-700 data-[state=active]:text-white"
          >
            <span className="icon-[lucide--file-terminal] mr-2 h-4 w-4" />
            {translate("control.tabs.editor")}
          </TabsTrigger>
          <TabsTrigger
            value="computer"
            className="inline-flex items-center justify-center rounded-lg py-2 text-sm font-semibold leading-none text-stone-400 transition-colors hover:bg-stone-800 hover:text-white data-[state=active]:bg-stone-700 data-[state=active]:text-white"
          >
            <span className="icon-[lucide--computer] mr-2 h-4 w-4" />
            {translate("control.tabs.computer")}
          </TabsTrigger>
        </TabsList>
      </>
    </Tabs>
  );
}
