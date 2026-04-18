import HomeView from '@/components/HomeView';
import { getAllFields, getLastUpdated } from '@/lib/data';

export default function HomePage() {
  return <HomeView fields={getAllFields()} lastUpdated={getLastUpdated()} />;
}
