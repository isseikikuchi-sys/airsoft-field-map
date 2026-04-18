import fieldsJson from '../../data/fields.json';
import updatesJson from '../../data/updates.json';
import type { Field, FieldsFile, UpdatesFile } from './types';

const fieldsFile = fieldsJson as FieldsFile;
const updatesFile = updatesJson as UpdatesFile;

export function getAllFields(): Field[] {
  return fieldsFile.fields;
}

export function getFieldById(id: string): Field | undefined {
  return fieldsFile.fields.find((f) => f.id === id);
}

export function getUpdate(id: string) {
  return updatesFile.updates[id];
}

export function getLastUpdated(): string {
  return updatesFile.last_updated;
}
