import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, Segmented } from '@/components/UI/primitives';
import { ExerciseCard } from '@/components/Exercise/ExerciseCard';
import { exercisesByJoint, JOINT_LABEL, JOINT_ORDER } from '@/services/exercise/exercises';
import type { JointName } from '@/types';

export default function ExerciseLibrary() {
  const { user } = useAuth();
  const groups = exercisesByJoint();
  const [filter, setFilter] = useState<JointName | 'all'>('all');
  const joints = filter === 'all' ? JOINT_ORDER : [filter];

  return (
    <div>
      <PageHeader title="Exercise library" subtitle="Each exercise is a configuration of landmarks, thresholds and form rules for the same movement engine." />
      <div className="mb-6 overflow-x-auto">
        <Segmented label="Filter by joint" value={filter} onChange={setFilter}
          options={[{ value: 'all', label: 'All' }, ...JOINT_ORDER.map((j) => ({ value: j, label: JOINT_LABEL[j] }))]} />
      </div>
      <div className="space-y-10">
        {joints.map((j) => (
          <section key={`${filter}-${j}`}>
            <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">{JOINT_LABEL[j]}<span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" /></h2>
            <div className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {groups[j].map((ex) => <ExerciseCard key={ex.id} ex={ex} canStart={user?.role === 'PATIENT'} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
