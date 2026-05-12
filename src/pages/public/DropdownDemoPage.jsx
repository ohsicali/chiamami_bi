import { useState } from "react";
import Dropdown from "../../components/UI/Dropdown";

const cityOptions = [
  { value: "torino", label: "Torino" },
  { value: "milano", label: "Milano" },
  { value: "roma", label: "Roma" },
  { value: "firenze", label: "Firenze" },
  { value: "napoli", label: "Napoli" },
];

const cuisineOptions = [
  { value: "pizza", label: "Pizza" },
  { value: "sushi", label: "Sushi" },
  { value: "burger", label: "Burger" },
  { value: "vegano", label: "Vegano" },
  { value: "trattoria", label: "Trattoria" },
];

export default function DropdownDemoPage() {
  const [city, setCity] = useState("torino");
  const [cuisine, setCuisine] = useState(null);

  return (
    <div className="min-h-screen bg-bg px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold text-primary mb-2">Demo Dropdown</h1>
        <p className="text-secondary mb-10">
          Due esempi del componente <code>Dropdown</code> riutilizzabile.
        </p>

        <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-1">
            Demo 1 — Città
          </h2>
          <p className="text-sm text-secondary mb-4">
            Dropdown con valore preselezionato.
          </p>
          <Dropdown
            label="Scegli una città"
            options={cityOptions}
            value={city}
            onChange={setCity}
            className="w-64"
          />
          <p className="mt-4 text-sm text-secondary">
            Selezionato:{" "}
            <span className="font-medium text-primary">{city ?? "—"}</span>
          </p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-1">
            Demo 2 — Cucina
          </h2>
          <p className="text-sm text-secondary mb-4">
            Dropdown senza valore iniziale.
          </p>
          <Dropdown
            label="Tipo di cucina"
            options={cuisineOptions}
            value={cuisine}
            onChange={setCuisine}
            className="w-64"
          />
          <p className="mt-4 text-sm text-secondary">
            Selezionato:{" "}
            <span className="font-medium text-primary">{cuisine ?? "—"}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
