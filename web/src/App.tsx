import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BeamPage } from '@/features/beam/BeamPage'
import { DeckPage } from '@/features/deck/DeckPage'

function App() {
  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Ponts à poutres — analyse AASHTO</h1>
        <p className="text-sm text-muted-foreground">
          Müller-Breslau · lignes d'influence · méthode de la bande équivalente
        </p>
      </header>

      <Tabs defaultValue="poutre">
        <TabsList>
          <TabsTrigger value="poutre">Poutre longitudinale</TabsTrigger>
          <TabsTrigger value="tablier">Tablier (dalle)</TabsTrigger>
        </TabsList>
        <TabsContent value="poutre" className="mt-4">
          <BeamPage />
        </TabsContent>
        <TabsContent value="tablier" className="mt-4">
          <DeckPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App
