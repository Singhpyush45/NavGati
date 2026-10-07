import { useAuth } from '@/context/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { backends } from '@/services/database';
import { MessageThread } from '@/components/Messages/MessageThread';
import { ErrorBox, PageHeader, Panel, Spinner } from '@/components/UI/primitives';

/** Patient → therapist messages (text + voice). */
export default function Messages() {
  const { user } = useAuth();
  const { data, error, loading, retry } = useAsync(() => backends.data.listMessages(user!.id), [user?.id]);
  if (loading) return <Spinner label="Loading messages…" />;
  if (error) return <ErrorBox message={error} onRetry={retry} />;
  return (
    <div className="space-y-6">
      <PageHeader title="Messages" subtitle="Tell your therapist about pain, questions or problems — by text or a voice note." />
      <Panel className="p-4 sm:p-6">
        <MessageThread patientId={user!.id} me={user!} initial={data ?? []} height={480} />
      </Panel>
    </div>
  );
}
