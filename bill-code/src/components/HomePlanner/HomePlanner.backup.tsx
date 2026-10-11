import { useState, useEffect } from 'react';
import { Plus, Bell, ChevronLeft, ChevronRight, X, Save, Trash2, ArrowRight } from 'lucide-react';

interface Reminder {
  id: string;
  title: string;
  time: string;
  date: string;
}

interface PlanBlock {
  id: string;
  type: 'start' | 'end' | 'code' | 'video' | 'photo' | 'paint' | 'web';
  label: string;
  description: string;
  x: number;
  y: number;
  nextId: string | null;
}

interface Plan {
  id: string;
  name: string;
  description: string;
  blocks: PlanBlock[];
  createdAt: number;
}

interface HomePlannerProps {
  onClose?: () => void;
}

export default function HomePlanner({ onClose }: HomePlannerProps) {
  // Inicializa com data e hora atual
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);
  
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const saved = localStorage.getItem('bill-reminders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [newReminder, setNewReminder] = useState({ title: '', time: currentTime, date: currentDate });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Estado para planejamentos
  const [plans, setPlans] = useState<Plan[]>(() => {
    try {
      const saved = localStorage.getItem('bill-plans');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', description: '' });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; afterBlockId: string } | null>(null);
  const [editingBlock, setEditingBlock] = useState<{ blockId: string; description: string } | null>(null);

  // Gera dias do calendário mensal
  const generateMonthCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = domingo
    
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Adiciona dias vazios do início
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Adiciona todos os dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      days.push({
        day,
        date: date.toISOString().split('T')[0],
        isToday: date.getTime() === today.getTime(),
        isPast: date < today,
      });
    }
    
    return days;
  };

  const monthDays = generateMonthCalendar();
  const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Salva reminders no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('bill-reminders', JSON.stringify(reminders));
    console.log('[HomePlanner] Lembretes salvos:', reminders);
  }, [reminders]);

  // Salva plans no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('bill-plans', JSON.stringify(plans));
    console.log('[HomePlanner] Planos salvos:', plans);
  }, [plans]);

  const handleAddReminder = () => {
    if (!newReminder.title || !newReminder.time || !newReminder.date) return;
    
    const reminder: Reminder = {
      id: Date.now().toString(),
      title: newReminder.title,
      time: newReminder.time,
      date: newReminder.date,
    };
    
    console.log('[HomePlanner] Adicionando lembrete:', reminder);
    setReminders([...reminders, reminder]);
    
    // Reseta para data/hora atual
    const now = new Date();
    setNewReminder({ 
      title: '', 
      time: now.toTimeString().slice(0, 5), 
      date: now.toISOString().split('T')[0] 
    });
    setShowReminderForm(false);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
    
    // Remove também da lista de lembretes já mostrados
    try {
      const shownKey = localStorage.getItem('bill-reminders-shown');
      if (shownKey) {
        const shown = JSON.parse(shownKey);
        const updated = shown.filter((shownId: string) => shownId !== id);
        localStorage.setItem('bill-reminders-shown', JSON.stringify(updated));
        console.log('[HomePlanner] Removido da lista de mostrados:', id);
      }
    } catch (e) {
      console.error('[HomePlanner] Erro ao limpar lembrete mostrado:', e);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // ─── FUNÇÕES DE PLANEJAMENTO ───
  const handleCreatePlan = () => {
    if (!newPlan.name.trim()) return;
    
    const startBlock: PlanBlock = {
      id: 'start',
      type: 'start',
      label: 'Projeto Inicial',
      description: '',
      x: 100,
      y: 200,
      nextId: 'end',
    };
    
    const endBlock: PlanBlock = {
      id: 'end',
      type: 'end',
      label: 'Projeto Final',
      description: '',
      x: 600,
      y: 200,
      nextId: null,
    };
    
    const plan: Plan = {
      id: Date.now().toString(),
      name: newPlan.name,
      description: newPlan.description,
      blocks: [startBlock, endBlock],
      createdAt: Date.now(),
    };
    
    setPlans([...plans, plan]);
    setSelectedPlan(plan);
    setNewPlan({ name: '', description: '' });
    setShowPlanForm(false);
    console.log('[HomePlanner] Plano criado:', plan);
  };

  const handleDeletePlan = (planId: string) => {
    setPlans(plans.filter(p => p.id !== planId));
    if (selectedPlan?.id === planId) {
      setSelectedPlan(null);
    }
  };

  const handleAddBlock = (type: 'code' | 'video' | 'photo' | 'paint' | 'web', afterBlockId: string) => {
    if (!selectedPlan) return;
    
    const afterBlock = selectedPlan.blocks.find(b => b.id === afterBlockId);
    if (!afterBlock) return;
    
    const typeLabels = {
      code: 'Code',
      video: 'Video',
      photo: 'Design',
      paint: 'Paint',
      web: 'Web',
    };
    
    const newBlock: PlanBlock = {
      id: Date.now().toString(),
      type,
      label: `${typeLabels[type]} Início`,
      description: '',
      x: afterBlock.x + 250,
      y: afterBlock.y,
      nextId: afterBlock.nextId,
    };
    
    // Atualiza o bloco anterior para apontar pro novo
    const updatedBlocks = selectedPlan.blocks.map(b =>
      b.id === afterBlockId ? { ...b, nextId: newBlock.id } : b
    );
    
    updatedBlocks.push(newBlock);
    
    const updatedPlan = { ...selectedPlan, blocks: updatedBlocks };
    setPlans(plans.map(p => p.id === selectedPlan.id ? updatedPlan : p));
    setSelectedPlan(updatedPlan);
    setContextMenu(null);
    
    // Reposiciona blocos para ficarem bem espaçados
    repositionBlocks(updatedPlan);
  };

  const handleUpdateBlockDescription = (blockId: string, description: string) => {
    if (!selectedPlan) return;
    
    const updatedBlocks = selectedPlan.blocks.map(b =>
      b.id === blockId ? { ...b, description } : b
    );
    
    const updatedPlan = { ...selectedPlan, blocks: updatedBlocks };
    setPlans(plans.map(p => p.id === selectedPlan.id ? updatedPlan : p));
    setSelectedPlan(updatedPlan);
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!selectedPlan) return;
    if (blockId === 'start' || blockId === 'end') return; // Não pode deletar início/fim
    
    const blockToDelete = selectedPlan.blocks.find(b => b.id === blockId);
    if (!blockToDelete) return;
    
    // Encontra o bloco que aponta pro que será deletado
    const previousBlock = selectedPlan.blocks.find(b => b.nextId === blockId);
    
    if (previousBlock) {
      // Atualiza o anterior para apontar pro próximo do deletado
      const updatedBlocks = selectedPlan.blocks
        .filter(b => b.id !== blockId)
        .map(b => b.id === previousBlock.id ? { ...b, nextId: blockToDelete.nextId } : b);
      
      const updatedPlan = { ...selectedPlan, blocks: updatedBlocks };
      setPlans(plans.map(p => p.id === selectedPlan.id ? updatedPlan : p));
      setSelectedPlan(updatedPlan);
      repositionBlocks(updatedPlan);
    }
  };

  const repositionBlocks = (plan: Plan) => {
    // Reposiciona os blocos em linha reta
    let currentBlock = plan.blocks.find(b => b.id === 'start');
    let xPos = 100;
    const yPos = 200;
    const spacing = 250;
    
    const newPositions: { [key: string]: { x: number; y: number } } = {};
    
    while (currentBlock) {
      newPositions[currentBlock.id] = { x: xPos, y: yPos };
      xPos += spacing;
      currentBlock = currentBlock.nextId ? plan.blocks.find(b => b.id === currentBlock!.nextId) : undefined;
    }
    
    const updatedBlocks = plan.blocks.map(b => ({
      ...b,
      x: newPositions[b.id]?.x ?? b.x,
      y: newPositions[b.id]?.y ?? b.y,
    }));
    
    const updatedPlan = { ...plan, blocks: updatedBlocks };
    setPlans(plans.map(p => p.id === plan.id ? updatedPlan : p));
    setSelectedPlan(updatedPlan);
  };

  const getRemindersForDate = (date: string) => {
    return reminders.filter(r => r.date === date);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#09090e',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      gap: '24px',
      overflow: 'hidden',
    }}>
      {/* Topo: Planejamento + Lembretes */}
      <div style={{ display: 'flex', gap: '24px', height: '280px' }}>
        {/* Planejamento (Esquerda) */}
        <div style={{
          flex: 1,
          background: 'linear-gradient(135deg, rgba(124, 92, 252, 0.1), rgba(102, 126, 234, 0.05))',
          borderRadius: '16px',
          border: '1px solid rgba(124, 92, 252, 0.2)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#c084fc' }}>
              Planejamentos
            </h3>
            <button
              style={{
                background: 'rgba(124, 92, 252, 0.2)',
                border: '1px solid rgba(124, 92, 252, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#c084fc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(124, 92, 252, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(124, 92, 252, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={14} />
              Novo Plano
            </button>
          </div>

          {/* Lista de Planejamentos (Vazia por enquanto) */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '14px',
            fontStyle: 'italic',
          }}>
            Nenhum planejamento criado
          </div>
        </div>

        {/* Lembretes (Direita) */}
        <div style={{
          flex: 1,
          background: 'linear-gradient(135deg, rgba(34, 197, 153, 0.1), rgba(16, 185, 129, 0.05))',
          borderRadius: '16px',
          border: '1px solid rgba(34, 197, 153, 0.2)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#34d399' }}>
              Lembretes
            </h3>
            <button
              onClick={() => setShowReminderForm(!showReminderForm)}
              style={{
                background: 'rgba(34, 197, 153, 0.2)',
                border: '1px solid rgba(34, 197, 153, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#34d399',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(34, 197, 153, 0.3)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(34, 197, 153, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={14} />
              Novo Lembrete
            </button>
          </div>

          {/* Form de Novo Lembrete */}
          {showReminderForm && (
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <input
                type="text"
                placeholder="Título do lembrete..."
                value={newReminder.title}
                onChange={e => setNewReminder({ ...newReminder, title: e.target.value })}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'white',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="date"
                  value={newReminder.date}
                  onChange={e => setNewReminder({ ...newReminder, date: e.target.value })}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <input
                  type="time"
                  value={newReminder.time}
                  onChange={e => setNewReminder({ ...newReminder, time: e.target.value })}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: 'white',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={handleAddReminder}
                style={{
                  background: 'rgba(34, 197, 153, 0.3)',
                  border: '1px solid rgba(34, 197, 153, 0.4)',
                  borderRadius: '8px',
                  padding: '10px',
                  color: '#34d399',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                Adicionar Lembrete
              </button>
            </div>
          )}

          {/* Lista de Lembretes */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {reminders.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '14px',
                fontStyle: 'italic',
              }}>
                Nenhum lembrete criado
              </div>
            ) : (
              reminders.map(reminder => (
                <div
                  key={reminder.id}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: '1px solid rgba(34, 197, 153, 0.2)',
                  }}
                >
                  <Bell size={16} color="#34d399" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>
                      {reminder.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {new Date(reminder.date).toLocaleDateString('pt-BR')} às {reminder.time}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteReminder(reminder.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Calendário Mensal Grid (Embaixo) */}
      <div style={{
        flex: 1,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '16px',
        border: '1px solid rgba(124, 92, 252, 0.3)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minHeight: 0,
      }}>
        {/* Header do Calendário */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 700,
            color: '#c084fc',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {monthName}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrevMonth}
              style={{
                background: 'rgba(124, 92, 252, 0.2)',
                border: '1px solid rgba(124, 92, 252, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#c084fc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.2)'}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              style={{
                background: 'rgba(124, 92, 252, 0.2)',
                border: '1px solid rgba(124, 92, 252, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#c084fc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.2)'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Grid do Calendário */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: 0,
        }}>
          {/* Dias da Semana */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(124, 92, 252, 0.2)',
          }}>
            {weekDays.map(day => (
              <div
                key={day}
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#7c5cfc',
                  letterSpacing: '0.5px',
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid de Dias */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: 'repeat(6, 1fr)',
            gap: '8px',
            minHeight: 0,
          }}>
            {monthDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} />;
              }

              const dayReminders = getRemindersForDate(day.date);
              const hasReminders = dayReminders.length > 0;

              return (
                <div
                  key={day.date}
                  style={{
                    background: day.isToday
                      ? 'linear-gradient(135deg, rgba(124, 92, 252, 0.4), rgba(102, 126, 234, 0.3))'
                      : day.isPast
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    border: day.isToday
                      ? '2px solid rgba(124, 92, 252, 0.6)'
                      : hasReminders
                      ? '1px solid rgba(34, 197, 153, 0.4)'
                      : '1px solid rgba(255,255,255,0.1)',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    opacity: day.isPast ? 0.5 : 1,
                  }}
                  onMouseEnter={e => {
                    if (!day.isPast) {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.zIndex = '10';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.zIndex = '1';
                  }}
                >
                  {/* Número do dia */}
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: day.isToday ? '#c084fc' : hasReminders ? '#34d399' : 'white',
                  }}>
                    {day.day}
                  </div>

                  {/* Indicador de lembretes */}
                  {hasReminders && (
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '2px',
                    }}>
                      {dayReminders.slice(0, 3).map((reminder) => (
                        <div
                          key={reminder.id}
                          title={`${reminder.time} - ${reminder.title}`}
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#34d399',
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
