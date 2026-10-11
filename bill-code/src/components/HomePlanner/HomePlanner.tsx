import { useState, useEffect } from 'react';
import { Plus, Bell, ChevronLeft, ChevronRight, X, Save, Trash2, ArrowRight, Clock } from 'lucide-react';
import PlanCanvas from './PlanCanvas';
import './HomePlanner.css';

interface Reminder {
  id: string;
  title: string;
  time: string;
  date: string;
  notes?: string;
  priority?: 'green' | 'yellow' | 'red';
  type?: 'message' | 'call'; // Tipo do lembrete: mensagem ou chamada
}

interface PlanBlock {
  id: string;
  type: 'start' | 'end' | 'code' | 'video' | 'photo' | 'paint' | 'web';
  label: string;
  description: string;
  x: number;
  y: number;
  nextId: string | null;
  status?: 'pending' | 'in-progress' | 'completed' | 'delayed';
  startDate?: string;
  startTime?: string;
  deadline?: string;
  deadlineTime?: string;
  notes?: Array<{ timestamp: number; text: string }>;
  preview?: string;
  projectStarted?: boolean; // Se o usuário clicou em "Iniciar Projeto"
  workFolder?: string; // Pasta de trabalho específica deste bloco
  saveId?: string; // ID do save vinculado (para paint/photo)
}

// Função para calcular status automático
function calculateBlockStatus(block: PlanBlock): 'pending' | 'in-progress' | 'completed' | 'delayed' {
  // Se já foi marcado como concluído, mantém
  if (block.status === 'completed') return 'completed';
  
  // Se o projeto foi iniciado pelo usuário
  if (block.projectStarted) {
    // Verifica se está atrasado
    if (block.deadline && block.deadlineTime) {
      const deadlineDate = new Date(`${block.deadline}T${block.deadlineTime}`);
      const now = new Date();
      if (now > deadlineDate) {
        return 'delayed';
      }
    }
    return 'in-progress';
  }
  
  // Se não iniciou, está pendente
  return 'pending';
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
  const [newReminder, setNewReminder] = useState({ title: '', time: currentTime, date: currentDate, priority: 'green' as 'green' | 'yellow' | 'red', type: 'call' as 'message' | 'call' });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [dateNotes, setDateNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('bill-date-notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Estado para planejamentos
  const [plans, setPlans] = useState<Plan[]>(() => {
    try {
      const saved = localStorage.getItem('bill-plans');
      const loadedPlans = saved ? JSON.parse(saved) : [];
      
      // Corrige planos antigos com blocos na mesma posição
      const fixedPlans = loadedPlans.map((plan: Plan) => {
        const hasValidPositions = plan.blocks.every((b, i) => {
          if (i === 0) return true;
          const prev = plan.blocks[i - 1];
          return b.x !== prev.x || b.y !== prev.y;
        });
        
        if (!hasValidPositions) {
          console.log('[HomePlanner] Corrigindo posições do plano:', plan.name);
          return {
            ...plan,
            blocks: plan.blocks.map((b, i) => ({
              ...b,
              x: 50 + (i * 250),
              y: 150,
            })),
          };
        }
        
        return plan;
      });
      
      return fixedPlans;
    } catch {
      return [];
    }
  });
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', description: '' });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<PlanBlock | null>(null);
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

  // Salva date notes no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('bill-date-notes', JSON.stringify(dateNotes));
  }, [dateNotes]);

  // Salva plans no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem('bill-plans', JSON.stringify(plans));
    console.log('[HomePlanner] Planos salvos:', plans);
  }, [plans]);

  // Escuta eventos de atualização de planos (quando nota é adicionada via IA ou botão de concluir)
  useEffect(() => {
    const handlePlansUpdated = () => {
      console.log('[HomePlanner] Evento plans-updated recebido. Recarregando...');
      try {
        const saved = localStorage.getItem('bill-plans');
        if (saved) {
          const loadedPlans = JSON.parse(saved);
          // Força atualização criando novo array
          setPlans([...loadedPlans]);
          console.log('[HomePlanner] Planos recarregados:', loadedPlans.length, 'planos');
          
          // Atualiza selectedBlock se estiver aberto
          if (selectedBlock) {
            let foundBlock: PlanBlock | null = null;
            for (const plan of loadedPlans) {
              const block = plan.blocks.find((b: PlanBlock) => b.id === selectedBlock.id);
              if (block) {
                foundBlock = block;
                break;
              }
            }
            if (foundBlock) {
              setSelectedBlock({...foundBlock});
              console.log('[HomePlanner] selectedBlock atualizado:', foundBlock.label, 'status:', foundBlock.status);
            }
          }
        }
      } catch (err) {
        console.error('[HomePlanner] Erro ao recarregar planos:', err);
      }
    };

    window.addEventListener('plans-updated', handlePlansUpdated);
    return () => window.removeEventListener('plans-updated', handlePlansUpdated);
  }, [selectedBlock]);

  const handleAddReminder = () => {
    if (!newReminder.title || !newReminder.time || !newReminder.date) return;
    
    const reminder: Reminder = {
      id: Date.now().toString(),
      title: newReminder.title,
      time: newReminder.time,
      date: newReminder.date,
      priority: newReminder.priority,
      type: newReminder.type,
    };
    
    console.log('[HomePlanner] Adicionando lembrete:', reminder);
    setReminders([...reminders, reminder]);
    
    // Reseta para data/hora atual
    const now = new Date();
    setNewReminder({ 
      title: '', 
      time: now.toTimeString().slice(0, 5), 
      date: now.toISOString().split('T')[0],
      priority: 'green',
      type: 'call',
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
      x: 50,
      y: 150,
      nextId: 'end',
    };
    
    const endBlock: PlanBlock = {
      id: 'end',
      type: 'end',
      label: 'Projeto Final',
      description: '',
      x: 550,
      y: 150,
      nextId: null,
    };
    
    const plan: Plan = {
      id: Date.now().toString(),
      name: newPlan.name,
      description: newPlan.description,
      blocks: [startBlock, endBlock],
      createdAt: Date.now(),
    };
    
    console.log('[HomePlanner] Plano criado com blocos:', plan.blocks.map(b => ({ id: b.id, x: b.x, y: b.y })));
    
    setPlans([...plans, plan]);
    setSelectedPlan(plan);
    setNewPlan({ name: '', description: '' });
    setShowPlanForm(false);
  };

  const handleDeletePlan = (planId: string) => {
    setPlans(plans.filter(p => p.id !== planId));
    if (selectedPlan?.id === planId) {
      setSelectedPlan(null);
    }
  };

  const handleUpdatePlan = (updatedPlan: Plan) => {
    // Atualiza status de todos os blocos antes de salvar
    const blocksWithStatus = updatedPlan.blocks.map(b => {
      // Só calcula status para blocos que não são start/end
      if (b.type === 'start' || b.type === 'end') return b;
      return {
        ...b,
        status: calculateBlockStatus(b),
      };
    });
    
    const planWithUpdatedStatus = { ...updatedPlan, blocks: blocksWithStatus };
    setPlans(plans.map(p => p.id === planWithUpdatedStatus.id ? planWithUpdatedStatus : p));
    setSelectedPlan(planWithUpdatedStatus);
    
    // Atualiza o bloco selecionado se for o mesmo
    if (selectedBlock) {
      const updatedSelectedBlock = blocksWithStatus.find(b => b.id === selectedBlock.id);
      if (updatedSelectedBlock) {
        setSelectedBlock(updatedSelectedBlock);
      }
    }
  };

  const getRemindersForDate = (date: string) => {
    return reminders.filter(r => r.date === date);
  };

  // Se um dia foi selecionado, mostra a view de detalhes
  if (selectedDate) {
    const dateReminders = getRemindersForDate(selectedDate);
    const dateObj = new Date(selectedDate + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const selectedReminder = selectedReminderId ? reminders.find(r => r.id === selectedReminderId) : null;
    
    return (
      <div className="home-planner-container" style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        gap: '24px',
        overflow: 'hidden',
      }}>
        {/* Header com botão voltar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="home-planner-section-header" style={{ margin: 0, fontSize: '24px', fontWeight: 700, textTransform: 'capitalize' }}>
              {formattedDate}
            </h2>
            <p className="home-planner-empty-state" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              {dateReminders.length} {dateReminders.length === 1 ? 'lembrete' : 'lembretes'}
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedDate(null);
              setSelectedReminderId(null);
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <ChevronLeft size={16} />
            Voltar
          </button>
        </div>

        {/* Conteúdo: Lembretes (Esquerda) + Anotações (Direita) */}
        <div style={{ flex: 1, display: 'flex', gap: '24px', minHeight: 0 }}>
          {/* Lembretes (Esquerda) */}
          <div className="home-planner-day-details-reminders" style={{
            flex: 1,
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflow: 'hidden',
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#34d399' }}>
              Lembretes do Dia
            </h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dateReminders.length === 0 ? (
                <div className="home-planner-empty-state" style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontStyle: 'italic',
                }}>
                  Nenhum lembrete para este dia
                </div>
              ) : (
                dateReminders.map(reminder => (
                  <div
                    key={reminder.id}
                    onClick={() => setSelectedReminderId(reminder.id)}
                    className="home-planner-reminder-card"
                    style={{
                      background: selectedReminderId === reminder.id ? 'rgba(34, 197, 153, 0.2)' : 'rgba(0,0,0,0.3)',
                      borderRadius: '12px',
                      padding: '14px',
                      border: selectedReminderId === reminder.id ? '2px solid rgba(34, 197, 153, 0.5)' : '1px solid rgba(34, 197, 153, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      if (selectedReminderId !== reminder.id) {
                        e.currentTarget.style.background = 'rgba(34, 197, 153, 0.1)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (selectedReminderId !== reminder.id) {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        {/* Bolinha de prioridade */}
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: reminder.priority === 'red' ? '#ef4444' : reminder.priority === 'yellow' ? '#eab308' : '#22c55e',
                          flexShrink: 0,
                        }} />
                        <div className="home-planner-reminder-title" style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {reminder.title}
                          {/* Ícone do tipo de lembrete */}
                          <span style={{ fontSize: '13px', opacity: 0.6 }}>
                            {(reminder.type || 'call') === 'call' ? '📞' : '💬'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReminders(reminders.filter(r => r.id !== reminder.id));
                          if (selectedReminderId === reminder.id) {
                            setSelectedReminderId(null);
                          }
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '13px' }}>
                      <Clock size={14} />
                      {reminder.time}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Anotações (Direita) */}
          <div className="home-planner-day-details-notes" style={{
            flex: 1,
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <h3 className="home-planner-section-header" style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Anotações
            </h3>
            {selectedReminder ? (
              <>
                <div className="home-planner-note-header" style={{ 
                  padding: '10px 12px', 
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}>
                  {selectedReminder.title}
                </div>
                <textarea
                  value={selectedReminder.notes || ''}
                  onChange={e => {
                    setReminders(reminders.map(r => 
                      r.id === selectedReminder.id 
                        ? { ...r, notes: e.target.value }
                        : r
                    ));
                  }}
                  placeholder="Escreva suas anotações sobre este lembrete..."
                  className="home-planner-textarea"
                  style={{
                    flex: 1,
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                />
              </>
            ) : (
              <div className="home-planner-empty-state" style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontStyle: 'italic',
                textAlign: 'center',
              }}>
                Selecione um lembrete para<br/>ver ou editar suas anotações
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-planner-container" style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px',
      gap: '24px',
      overflow: 'hidden',
    }}>
      {/* Topo: Planejamento + Lembretes */}
      <div style={{ display: 'flex', gap: '24px', height: '280px' }}>
        {/* Planejamento (Esquerda) */}
        <div className="home-planner-section" style={{
          flex: 1,
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          minHeight: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="home-planner-section-header" style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              Planejamentos
            </h3>
            <button
              onClick={() => setShowPlanForm(true)}
              className="home-planner-calendar-nav-btn"
              style={{
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={14} />
              Novo Plano
            </button>
          </div>

          {/* Lista de Planejamentos */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {plans.length === 0 ? (
              <div className="home-planner-empty-state" style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontStyle: 'italic',
              }}>
                Nenhum planejamento criado
              </div>
            ) : (
              plans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: '1px solid rgba(124, 92, 252, 0.2)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124, 92, 252, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'white' }}>
                      {plan.name}
                    </div>
                    {plan.description && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {plan.description}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      {plan.blocks.length - 2} blocos
                    </div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeletePlan(plan.id);
                    }}
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

        {/* Lembretes (Direita) */}
        <div className="home-planner-section" style={{
          flex: 1,
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto',
          minHeight: 0,
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
                className="home-planner-input"
                style={{
                  borderRadius: '8px',
                  padding: '10px 12px',
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
              {/* Seletor de Prioridade */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '13px', color: '#888' }}>Urgência:</div>
                {[
                  { color: 'green', bg: '#22c55e', label: 'Baixa' },
                  { color: 'yellow', bg: '#eab308', label: 'Média' },
                  { color: 'red', bg: '#ef4444', label: 'Alta' },
                ].map(({ color, bg, label }) => (
                  <button
                    key={color}
                    onClick={() => setNewReminder({ ...newReminder, priority: color as 'green' | 'yellow' | 'red' })}
                    style={{
                      background: newReminder.priority === color ? bg : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${newReminder.priority === color ? bg : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                    title={label}
                    onMouseEnter={e => {
                      if (newReminder.priority !== color) {
                        e.currentTarget.style.border = `2px solid ${bg}`;
                      }
                    }}
                    onMouseLeave={e => {
                      if (newReminder.priority !== color) {
                        e.currentTarget.style.border = '2px solid rgba(255,255,255,0.1)';
                      }
                    }}
                  >
                    {newReminder.priority === color && (
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '12px',
                        height: '12px',
                        background: 'white',
                        borderRadius: '50%',
                      }} />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Seletor de Tipo */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#888', marginRight: '4px' }}>Tipo:</div>
                <button
                  onClick={() => setNewReminder({ ...newReminder, type: 'message' })}
                  style={{
                    flex: 1,
                    background: newReminder.type === 'message' ? 'rgba(124, 92, 252, 0.3)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${newReminder.type === 'message' ? '#7c5cfc' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: newReminder.type === 'message' ? '#a78bfa' : '#888',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: newReminder.type === 'message' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (newReminder.type !== 'message') {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (newReminder.type !== 'message') {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }
                  }}
                >
                  💬 Mensagem
                </button>
                <button
                  onClick={() => setNewReminder({ ...newReminder, type: 'call' })}
                  style={{
                    flex: 1,
                    background: newReminder.type === 'call' ? 'rgba(124, 92, 252, 0.3)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${newReminder.type === 'call' ? '#7c5cfc' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: newReminder.type === 'call' ? '#a78bfa' : '#888',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: newReminder.type === 'call' ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (newReminder.type !== 'call') {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.borderColor = 'rgba(124, 92, 252, 0.4)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (newReminder.type !== 'call') {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    }
                  }}
                >
                  📞 Chamada
                </button>
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
                  {/* Bolinha de prioridade */}
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: reminder.priority === 'red' ? '#ef4444' : reminder.priority === 'yellow' ? '#eab308' : '#22c55e',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {reminder.title}
                      {/* Ícone do tipo de lembrete */}
                      <span style={{ fontSize: '12px', opacity: 0.6 }}>
                        {(reminder.type || 'call') === 'call' ? '📞' : '💬'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {new Date(reminder.date + 'T12:00:00').toLocaleDateString('pt-BR')} às {reminder.time}
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
      <div className="home-planner-calendar" style={{
        flex: 1,
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minHeight: 0,
      }}>
        {/* Header do Calendário */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="home-planner-calendar-header" style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}>
            {monthName}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handlePrevMonth}
              className="home-planner-calendar-nav-btn"
              style={{
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              className="home-planner-calendar-nav-btn"
              style={{
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s',
              }}
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
          <div className="home-planner-weekday-divider" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px',
            paddingBottom: '8px',
          }}>
            {weekDays.map(day => (
              <div
                key={day}
                className="home-planner-weekday"
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
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
                  onClick={() => setSelectedDate(day.date)}
                  className={`home-planner-day ${day.isToday ? 'today' : ''} ${day.isPast ? 'past' : ''} ${hasReminders ? 'has-reminders' : ''}`}
                  style={{
                    borderRadius: '10px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
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
                  <div className="home-planner-day-number" style={{
                    fontSize: '18px',
                    fontWeight: 700,
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
                      {dayReminders.slice(0, 12).map((reminder) => (
                        <div
                          key={reminder.id}
                          title={`${reminder.time} - ${reminder.title}`}
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: reminder.priority === 'red' ? '#ef4444' : reminder.priority === 'yellow' ? '#eab308' : '#22c55e',
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

      {/* Canvas de Planejamento (Embaixo do Calendário) */}
      {selectedPlan && (
        <div style={{
          background: 'linear-gradient(to bottom, #0a0a12 0%, #050508 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(124, 92, 252, 0.3)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          height: '500px',
          position: 'relative',
        }}>
          {/* Header do Canvas */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(124, 92, 252, 0.2)',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#c084fc' }}>
                {selectedPlan.name}
              </h3>
              {selectedPlan.description && (
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#888' }}>
                  {selectedPlan.description}
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedPlan(null)}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <X size={14} />
              Fechar
            </button>
          </div>

          {/* Canvas Container */}
          <PlanCanvas
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
            onUpdatePlan={handleUpdatePlan}
            onSelectBlock={setSelectedBlock}
          />
        </div>
      )}

      {/* Detalhes do Bloco Selecionado */}
      {selectedBlock && selectedPlan && (
        <div style={{
          background: 'linear-gradient(to bottom, #0a0a12 0%, #050508 100%)',
          borderRadius: '16px',
          border: '1px solid rgba(124, 92, 252, 0.3)',
          padding: '24px',
          display: 'flex',
          gap: '24px',
          height: '300px',
        }}>
          {/* Preview à esquerda */}
          <div style={{
            width: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}>
              {selectedBlock.preview ? (
                <img src={selectedBlock.preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ color: '#666', fontSize: '14px', textAlign: 'center' }}>
                  Sem preview<br/>disponível
                </div>
              )}
              {/* Nome e Status em cima da imagem */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>
                  {selectedBlock.label}
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  alignSelf: 'flex-start',
                  ...(() => {
                    const status = calculateBlockStatus(selectedBlock);
                    if (status === 'pending') return { background: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af' };
                    if (status === 'in-progress') return { background: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' };
                    if (status === 'completed') return { background: 'rgba(34, 197, 94, 0.3)', color: '#34d399' };
                    if (status === 'delayed') return { background: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' };
                    return {};
                  })(),
                }}>
                  {(() => {
                    const status = calculateBlockStatus(selectedBlock);
                    if (status === 'pending') return 'Pendente';
                    if (status === 'in-progress') return 'Em Andamento';
                    if (status === 'completed') return 'Concluído';
                    if (status === 'delayed') return 'Atrasado';
                    return '';
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Informações à direita */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            {/* Datas */}
            <div style={{
              display: 'flex',
              gap: '16px',
              padding: '16px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>DATA DE HOJE</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>
                  {new Date().toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>PRAZO</div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#c084fc' }}>
                  {selectedBlock.deadline ? selectedBlock.deadline.split('-').reverse().join('/') : 'Sem prazo'}
                </div>
              </div>
            </div>

            {/* Notas da IA */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              minHeight: 0,
            }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: '#c084fc',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Notas do Progresso
              </div>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: 0,
              }}>
                {selectedBlock.notes && selectedBlock.notes.length > 0 ? (
                  // Mostra apenas as 4 últimas notas (mais recentes)
                  selectedBlock.notes.slice(-4).reverse().map((note, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      border: '1px solid rgba(255,255,255,0.05)',
                      flexShrink: 0,
                    }}>
                      <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
                        {new Date(note.timestamp).toLocaleString('pt-BR')}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#ccc',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        whiteSpace: 'normal',
                      }}>
                        {note.text}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#666',
                    fontSize: '13px',
                    fontStyle: 'italic',
                  }}>
                    Nenhuma nota registrada ainda
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botão fechar */}
          <button
            onClick={() => setSelectedBlock(null)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '6px',
              color: '#888',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
          
          {/* Botão Concluir Projeto */}
          <button
            onClick={() => {
              // Atualiza o status do bloco
              const updatedPlans = plans.map(plan => ({
                ...plan,
                blocks: plan.blocks.map(b =>
                  b.id === selectedBlock.id
                    ? { ...b, status: 'completed', completedAt: new Date().toISOString() }
                    : b
                )
              }));
              setPlans(updatedPlans);
              localStorage.setItem('bill-plans', JSON.stringify(updatedPlans));
              window.dispatchEvent(new CustomEvent('plans-updated'));
              setSelectedBlock(null);
            }}
            style={{
              position: 'absolute',
              top: '24px',
              right: '70px',
              background: selectedBlock.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(124, 92, 252, 0.2)',
              border: `1px solid ${selectedBlock.status === 'completed' ? '#22c55e' : '#7c5cfc'}`,
              borderRadius: '8px',
              padding: '8px 16px',
              color: selectedBlock.status === 'completed' ? '#22c55e' : '#c084fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = selectedBlock.status === 'completed' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(124, 92, 252, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = selectedBlock.status === 'completed' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(124, 92, 252, 0.2)';
            }}
          >
            {selectedBlock.status === 'completed' ? '✓ Concluído' : 'Concluir Projeto'}
          </button>
        </div>
      )}

      {/* Modal: Criar Novo Planejamento */}
      {showPlanForm && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowPlanForm(false)}
        >
          <div
            style={{
              background: '#1a1a24',
              border: '1px solid rgba(124, 92, 252, 0.3)',
              borderRadius: '16px',
              padding: '32px',
              width: '500px',
              maxWidth: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#c084fc' }}>
              Novo Planejamento
            </h2>
            <input
              type="text"
              placeholder="Nome do projeto..."
              value={newPlan.name}
              onChange={e => setNewPlan({ ...newPlan, name: e.target.value })}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '14px 16px',
                color: 'white',
                fontSize: '15px',
                outline: 'none',
              }}
            />
            <textarea
              placeholder="Descrição do projeto... (opcional)"
              value={newPlan.description}
              onChange={e => setNewPlan({ ...newPlan, description: e.target.value })}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '14px 16px',
                color: 'white',
                fontSize: '15px',
                outline: 'none',
                minHeight: '100px',
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCreatePlan}
                disabled={!newPlan.name.trim()}
                style={{
                  flex: 1,
                  background: newPlan.name.trim() ? 'rgba(124, 92, 252, 0.3)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${newPlan.name.trim() ? 'rgba(124, 92, 252, 0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px',
                  padding: '14px',
                  color: newPlan.name.trim() ? '#c084fc' : '#666',
                  cursor: newPlan.name.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Criar Planejamento
              </button>
              <button
                onClick={() => setShowPlanForm(false)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '14px',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
