import HomeView from '@/components/HomeView';
import { getAllFields, getAllUpdates, getLastUpdated } from '@/lib/data';

export default function HomePage() {
  return (
    <HomeView
      fields={getAllFields()}
      updates={getAllUpdates()}
      lastUpdated={getLastUpdated()}
    />
  );
}
