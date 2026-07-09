export interface ItemPlantilla {
  id: number;
  plantilla_id: number;
  label: string;
  orden: number;
}

export interface Plantilla {
  id: number;
  nombre: string;
  descripcion?: string | null;
  workspace_id: number;
  items: ItemPlantilla[];
  workspace?: { id: number; nombre: string };
  createdAt?: string;
  updatedAt?: string;
}
