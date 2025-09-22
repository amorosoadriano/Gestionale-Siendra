import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';

// --- DATA TYPES --- //

interface Customer {
    id: string;
    companyName: string;
    address: string;
    vatNumber: string;
    email: string;
    pec: string;
}

interface Service {
    id: string;
    name: string;
    subTasks: string[];
}

interface Staff {
    id: string;
    name: string;
}

interface SubTask {
    id: string;
    name: string;
    completed: boolean;
    executorId?: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
    // Billing specific
    invoiceNumber?: string;
    invoiceDate?: string;
    paymentDate?: string;
    paymentMethod?: 'Bonifico' | 'Banca' | 'Assegno' | 'Contanti';
    doInvoice?: boolean;
    invoiceNotes?: string;
}

interface Job {
    id: string;
    customerId: string;
    serviceId: string;
    startDate: string;
    responsibleId: string;
    deadlineDate: string;
    closingDate: string;
    archived: boolean;
    subTasks: SubTask[];
}

type ModalType = 
    | { type: 'job'; job?: Job }
    | { type: 'customer'; customer?: Customer }
    | { type: 'service'; service?: Service }
    | { type: 'staff'; staff?: Staff }
    | null;

type Tab = 'dashboard' | 'jobs' | 'customers' | 'billing' | 'settings';

// --- UTILS --- //

const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
};

const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT');
};

const getStatus = (deadlineDate: string, subTasks: SubTask[]) => {
    const allCompleted = subTasks.every(t => t.completed);
    if (allCompleted) return { label: 'Completato', color: 'gray' };

    const deadline = new Date(deadlineDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Scaduto', color: 'red' };
    if (diffDays <= 3) return { label: 'In Scadenza', color: 'yellow' };
    return { label: 'In Corso', color: 'green' };
};


// --- MODALS --- //

interface JobFormModalProps {
    job?: Job;
    customers: Customer[];
    services: Service[];
    staff: Staff[];
    onSave: (job: Job) => void;
    onClose: () => void;
}

const JobFormModal: React.FC<JobFormModalProps> = ({ job, customers, services, staff, onSave, onClose }) => {
    const [formData, setFormData] = useState<Omit<Job, 'id' | 'archived' | 'subTasks'>>(
        job ? { ...job } : {
        customerId: '',
        serviceId: '',
        startDate: new Date().toISOString().split('T')[0],
        responsibleId: '',
        deadlineDate: '',
        closingDate: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const service = services.find(s => s.id === formData.serviceId);
        // FIX: Explicitly type the result of the map to `SubTask` to resolve a TypeScript type inference issue.
        // The `.map()` function was creating an array where the object type was too narrow. By specifying the return
        // type as `SubTask`, we ensure the array is of type `SubTask[]`, allowing concatenation with other
        // objects that conform to the `SubTask` interface, even if they have different optional properties.
        const subTasks: SubTask[] = (service?.subTasks ?? [])
            .map((name): SubTask => ({ id: crypto.randomUUID(), name, completed: false }))
            .concat([{ 
                id: crypto.randomUUID(), 
                name: 'Fatturazione', 
                completed: false, 
                paymentMethod: 'Bonifico'
            }]);

        const newJob: Job = {
            id: job?.id || crypto.randomUUID(),
            ...formData,
            archived: job?.archived || false,
            subTasks: job?.subTasks || subTasks
        };
        onSave(newJob);
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{job ? 'Modifica Lavoro' : 'Nuovo Lavoro'}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Cliente</label>
                            <select name="customerId" value={formData.customerId} onChange={handleChange} required>
                                <option value="" disabled>Seleziona un cliente</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Tipo di Servizio</label>
                            <select name="serviceId" value={formData.serviceId} onChange={handleChange} required>
                                <option value="" disabled>Seleziona un servizio</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Data Inizio Lavoro</label>
                            <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Responsabile</label>
                            <select name="responsibleId" value={formData.responsibleId} onChange={handleChange} required>
                                <option value="" disabled>Seleziona un responsabile</option>
                                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Data Prevista Lavorazione</label>
                            <input type="date" name="deadlineDate" value={formData.deadlineDate} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Data Chiusura Lavoro</label>
                            <input type="date" name="closingDate" value={formData.closingDate} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="btn btn-primary">Salva Lavoro</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


interface CustomerFormModalProps {
    customer?: Customer;
    onSave: (customer: Customer) => void;
    onClose: () => void;
}

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({ customer, onSave, onClose }) => {
    const [formData, setFormData] = useState<Omit<Customer, 'id'>>(customer || {
        companyName: '', address: '', vatNumber: '', email: '', pec: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: customer?.id || crypto.randomUUID(), ...formData });
    };

    return (
         <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{customer ? 'Modifica Cliente' : 'Nuovo Cliente'}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>Ragione Sociale</label>
                            <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label>Indirizzo</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} />
                        </div>
                         <div className="form-group">
                            <label>Partita IVA / CF</label>
                            <input type="text" name="vatNumber" value={formData.vatNumber} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label>Email Principale</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} />
                        </div>
                         <div className="form-group">
                            <label>PEC</label>
                            <input type="email" name="pec" value={formData.pec} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="btn btn-primary">Salva Cliente</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface ServiceFormModalProps {
    service?: Service;
    onSave: (service: Service) => void;
    onClose: () => void;
}

const ServiceFormModal: React.FC<ServiceFormModalProps> = ({ service, onSave, onClose }) => {
    const [name, setName] = useState(service?.name || '');
    const [subTasks, setSubTasks] = useState(service?.subTasks?.join('\n') || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: service?.id || crypto.randomUUID(),
            name,
            subTasks: subTasks.split('\n').filter(st => st.trim() !== '')
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{service ? 'Modifica Servizio' : 'Nuovo Servizio'}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nome Servizio</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Sotto-Lavorazioni (una per riga)</label>
                        <textarea value={subTasks} onChange={(e) => setSubTasks(e.target.value)} />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="btn btn-primary">Salva Servizio</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface StaffFormModalProps {
    staffMember?: Staff;
    onSave: (staff: Staff) => void;
    onClose: () => void;
}

const StaffFormModal: React.FC<StaffFormModalProps> = ({ staffMember, onSave, onClose }) => {
    const [name, setName] = useState(staffMember?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ id: staffMember?.id || crypto.randomUUID(), name });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{staffMember ? 'Modifica Persona' : 'Nuova Persona'}</h2>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nome</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Annulla</button>
                        <button type="submit" className="btn btn-primary">Salva Persona</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- VIEWS --- //

interface DashboardViewProps {
    jobs: Job[];
    customers: Customer[];
    services: Service[];
    onSelectJob: (jobId: string) => void;
    onSelectTab: (tab: Tab) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ jobs, customers, services, onSelectJob, onSelectTab }) => {
    const getCustomerName = useCallback((id: string) => customers.find(c => c.id === id)?.companyName || 'N/A', [customers]);
    const getServiceName = useCallback((id: string) => services.find(s => s.id === id)?.name || 'N/A', [services]);

    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setHours(0, 0, 0, 0);
        sevenDaysFromNow.setDate(today.getDate() + 7);

        const jobsDueSoon = jobs
            .filter(j => !j.archived && j.deadlineDate)
            .map(j => {
                const [year, month, day] = j.deadlineDate.split('-').map(Number);
                const deadline = new Date(year, month - 1, day);
                return { ...j, deadline };
            })
            .filter(j => j.deadline >= today && j.deadline <= sevenDaysFromNow)
            .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
            .slice(0, 5);
        
        const invoicesToDo = jobs.flatMap(job => 
            job.subTasks
                .filter(st => st.name === 'Fatturazione' && st.doInvoice && (!st.invoiceNumber || !st.invoiceDate))
        );

        const invoicesToCollect = jobs.flatMap(job => 
            job.subTasks
                .filter(st => st.name === 'Fatturazione' && st.invoiceNumber && st.invoiceDate && !st.paymentDate)
                .map(st => ({ job, subTask: st }))
        ).slice(0, 5);

        const recentJobs = [...jobs]
            .filter(j => !j.archived)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
            .slice(0, 5);

        return {
            jobsInProgress: jobs.filter(j => !j.archived).length,
            jobsArchived: jobs.filter(j => j.archived).length,
            totalCustomers: customers.length,
            jobsDueSoon,
            invoicesToDoCount: invoicesToDo.length,
            invoicesToCollect,
            recentJobs
        };
    }, [jobs, customers]);

    const timeDiffString = (deadlineStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const [year, month, day] = deadlineStr.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);
        
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Oggi';
        if (diffDays === 1) return 'Domani';
        if (diffDays > 1) return `tra ${diffDays} giorni`;
        return '';
    };

    return (
        <div>
            <div className="header">
                <h1>Dashboard</h1>
            </div>
            <div className="dashboard-grid">
                <div className="dashboard-card card-quick-stats">
                    <h3>📈 Statistiche Veloci</h3>
                    <div className="quick-stats-container">
                        <div className="quick-stats-item">
                            <div className="stat-number">{stats.jobsInProgress}</div>
                            <div className="stat-label">Lavori in Corso</div>
                        </div>
                        <div className="quick-stats-item">
                            <div className="stat-number">{stats.totalCustomers}</div>
                            <div className="stat-label">Clienti Attivi</div>
                        </div>
                        <div className="quick-stats-item">
                            <div className="stat-number">{stats.jobsArchived}</div>
                            <div className="stat-label">Lavori Archiviati</div>
                        </div>
                    </div>
                </div>
                
                <div className="dashboard-card card-billing-summary" onClick={() => onSelectTab('billing')}>
                     <h3>💰 Riepilogo Fatturazione</h3>
                     <div className="billing-summary-container">
                        <div className="billing-summary-item">
                            <div className="stat-number">{stats.invoicesToDoCount}</div>
                            <div className="stat-label">Fatture da Emettere</div>
                        </div>
                        <div className="billing-summary-item">
                             <div className="stat-number">{stats.invoicesToCollect.length}</div>
                            <div className="stat-label">Fatture da Incassare</div>
                        </div>
                     </div>
                     <span className="card-link">Vai alla Fatturazione →</span>
                </div>

                <div className="dashboard-card card-full-width">
                    <h3>📅 Lavori in Scadenza (prox. 7 giorni)</h3>
                    {stats.jobsDueSoon.length > 0 ? (
                        <ul className="dashboard-list">
                            {stats.jobsDueSoon.map(job => (
                                <li key={job.id} onClick={() => onSelectJob(job.id)}>
                                    <div className="list-item-main">
                                        <strong>{getCustomerName(job.customerId)}</strong> - <span>{getServiceName(job.serviceId)}</span>
                                    </div>
                                    <div className="list-item-sub">
                                        Scadenza: {formatDate(job.deadlineDate)} ({timeDiffString(job.deadlineDate)})
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="empty-state">Nessun lavoro in scadenza nei prossimi 7 giorni.</p>}
                </div>

                <div className="dashboard-card">
                    <h3>⏳ Lavori Recenti</h3>
                     {stats.recentJobs.length > 0 ? (
                        <ul className="dashboard-list">
                            {stats.recentJobs.map(job => (
                                <li key={job.id} onClick={() => onSelectJob(job.id)}>
                                    <div className="list-item-main">
                                        <strong>{getCustomerName(job.customerId)}</strong>
                                    </div>
                                    <div className="list-item-sub">
                                        {getServiceName(job.serviceId)} - Iniziato il {formatDate(job.startDate)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="empty-state">Nessun lavoro recente.</p>}
                </div>
                
                <div className="dashboard-card">
                    <h3>🧾 Fatture da Incassare</h3>
                    {stats.invoicesToCollect.length > 0 ? (
                        <ul className="dashboard-list">
                            {stats.invoicesToCollect.map(({ job, subTask }) => (
                                <li key={job.id} onClick={() => onSelectJob(job.id)}>
                                    <div className="list-item-main">
                                        <strong>{getCustomerName(job.customerId)}</strong>
                                    </div>
                                    <div className="list-item-sub">
                                        Fattura n. {subTask.invoiceNumber} del {formatDate(subTask.invoiceDate!)}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="empty-state">Nessuna fattura da incassare.</p>}
                     <span className="card-link" onClick={() => onSelectTab('billing')}>Vedi tutte →</span>
                </div>
            </div>
        </div>
    );
};

interface JobsViewProps {
    jobs: Job[];
    customers: Customer[];
    services: Service[];
    staff: Staff[];
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
    onEdit: (job: Job) => void;
    initialExpandedJobId?: string | null;
    setInitialExpandedJobId: (id: string | null) => void;
}

const JobsView: React.FC<JobsViewProps> = ({ jobs, customers, services, staff, setJobs, onEdit, initialExpandedJobId, setInitialExpandedJobId }) => {
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    const [filters, setFilters] = useState({ customerId: '', responsibleId: '', status: '' });

    useEffect(() => {
        if(initialExpandedJobId) {
            const job = jobs.find(j => j.id === initialExpandedJobId);
            if(job) {
                setShowArchived(job.archived);
                setExpandedJobId(initialExpandedJobId);
            }
            setInitialExpandedJobId(null);
        }
    }, [initialExpandedJobId, jobs, setInitialExpandedJobId]);


    const handleToggleExpand = (jobId: string) => {
        setExpandedJobId(prevId => (prevId === jobId ? null : jobId));
    };

    const handleUpdateSubTask = (jobId: string, subTaskId: string, updatedFields: Partial<SubTask>) => {
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.id === jobId) {
                return {
                    ...job,
                    subTasks: job.subTasks.map(st => {
                        if (st.id === subTaskId) {
                            const newSubTask = { ...st, ...updatedFields };
                            if (st.name === 'Fatturazione') {
                                if ('paymentDate' in updatedFields) {
                                    newSubTask.completed = !!updatedFields.paymentDate;
                                } else if('completed' in updatedFields && !updatedFields.completed) {
                                    newSubTask.paymentDate = '';
                                }
                            } else {
                                if ('endDate' in updatedFields) {
                                    newSubTask.completed = !!updatedFields.endDate;
                                } else if('completed' in updatedFields && !updatedFields.completed) {
                                    newSubTask.endDate = '';
                                }
                            }
                            return newSubTask;
                        }
                        return st;
                    })
                };
            }
            return job;
        }));
    };
    
    const handleDeleteJob = (jobId: string) => {
        if (window.confirm('Sei sicuro di voler eliminare questo lavoro?')) {
            setJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
        }
    };
    
    const handleArchiveJob = (jobId: string, archive: boolean) => {
         setJobs(prevJobs => prevJobs.map(job =>
            job.id === jobId ? { ...job, archived: archive } : job
        ));
    };

    const getCustomerName = useCallback((id: string) => customers.find(c => c.id === id)?.companyName || 'N/A', [customers]);
    const getServiceName = useCallback((id: string) => services.find(s => s.id === id)?.name || 'N/A', [services]);
    const getStaffName = useCallback((id: string) => staff.find(s => s.id === id)?.name || 'N/A', [staff]);

    const filteredJobs = useMemo(() => {
        return jobs
            .filter(job => job.archived === showArchived)
            .filter(job => !filters.customerId || job.customerId === filters.customerId)
            .filter(job => !filters.responsibleId || job.responsibleId === filters.responsibleId)
            .filter(job => {
                if (!filters.status) return true;
                const status = getStatus(job.deadlineDate, job.subTasks);
                return status.label === filters.status;
            });
    }, [jobs, showArchived, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => setFilters({ customerId: '', responsibleId: '', status: '' });


    return (
        <div>
            <div className="header">
                <h1>{showArchived ? 'Lavori Archiviati' : 'Lavori in Corso'}</h1>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => setShowArchived(!showArchived)}>
                        {showArchived ? 'Vedi Lavori in Corso' : 'Vedi Archivio'}
                    </button>
                    {!showArchived && (
                         <button className="btn btn-primary" onClick={() => onEdit({} as Job)}>+ Aggiungi Lavoro</button>
                    )}
                </div>
            </div>

            {!showArchived && (
                 <div className="filter-bar">
                    <div>
                        <label htmlFor="customer-filter">Cliente</label>
                        <select id="customer-filter" name="customerId" value={filters.customerId} onChange={handleFilterChange}>
                            <option value="">Tutti i Clienti</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="responsible-filter">Responsabile</label>
                        <select id="responsible-filter" name="responsibleId" value={filters.responsibleId} onChange={handleFilterChange}>
                            <option value="">Tutti i Responsabili</option>
                            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="status-filter">Stato</label>
                        <select id="status-filter" name="status" value={filters.status} onChange={handleFilterChange}>
                            <option value="">Tutti gli Stati</option>
                            <option value="In Corso">In Corso</option>
                            <option value="In Scadenza">In Scadenza</option>
                            <option value="Scaduto">Scaduto</option>
                        </select>
                    </div>
                    <button className="btn btn-secondary" onClick={resetFilters}>Azzera Filtri</button>
                </div>
            )}
            
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: '20%' }}>Cliente</th>
                            <th style={{ width: '20%' }}>Servizio</th>
                            <th>Data Inizio</th>
                            <th>Scadenza</th>
                            <th>Responsabile</th>
                            <th style={{ width: '50px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredJobs.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center' }}>Nessun lavoro da mostrare.</td></tr>
                        ) : filteredJobs.map(job => {
                            const status = getStatus(job.deadlineDate, job.subTasks);
                            const allSubTasksCompleted = job.subTasks.every(st => st.completed);

                            return (
                                <React.Fragment key={job.id}>
                                    <tr onClick={() => handleToggleExpand(job.id)}>
                                        <td>
                                            <span className={`status-indicator status-${status.color}`}></span>
                                            {getCustomerName(job.customerId)}
                                        </td>
                                        <td>{getServiceName(job.serviceId)}</td>
                                        <td>{formatDate(job.startDate)}</td>
                                        <td>{formatDate(job.deadlineDate)}</td>
                                        <td>{getStaffName(job.responsibleId)}</td>
                                        <td className="actions">
                                            {showArchived ? (
                                                <button onClick={(e) => { e.stopPropagation(); handleArchiveJob(job.id, false); }} title="Ripristina">↩️</button>
                                            ) : (
                                                <>
                                                    <button onClick={(e) => { e.stopPropagation(); onEdit(job); }} title="Modifica">✏️</button>
                                                    <div className="tooltip">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleArchiveJob(job.id, true); }} 
                                                            disabled={!allSubTasksCompleted}
                                                            title="Archivia"
                                                        >
                                                            🗄️
                                                        </button>
                                                        {!allSubTasksCompleted && <span className="tooltiptext">Completa tutte le sotto-lavorazioni per archiviare</span>}
                                                    </div>
                                                    <button className="delete" onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }} title="Elimina">🗑️</button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                    {expandedJobId === job.id && (
                                        <tr className="job-details-row">
                                            <td colSpan={6}>
                                                <div className="job-details-content">
                                                    <ul className="sub-task-list">
                                                        {job.subTasks.map(st => (
                                                            <li key={st.id} className="sub-task-item">
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={st.completed}
                                                                    onChange={(e) => handleUpdateSubTask(job.id, st.id, { completed: e.target.checked })}
                                                                />
                                                                <div>
                                                                    <div className="sub-task-header"><h4>{st.name}</h4></div>
                                                                    {st.name === 'Fatturazione' ? (
                                                                        <div className="sub-task-billing-grid">
                                                                            <div className="form-group">
                                                                                <label>Fare Fattura</label>
                                                                                <input type="checkbox" checked={!!st.doInvoice} onChange={e => handleUpdateSubTask(job.id, st.id, { doInvoice: e.target.checked })} />
                                                                            </div>
                                                                            <div className="form-group">
                                                                                <label>Note Fattura</label>
                                                                                <input type="text" value={st.invoiceNotes || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { invoiceNotes: e.target.value })} />
                                                                            </div>
                                                                            <div className="form-group">
                                                                                <label>Numero Fattura</label>
                                                                                <input type="text" value={st.invoiceNumber || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { invoiceNumber: e.target.value })} />
                                                                            </div>
                                                                            <div className="form-group">
                                                                                <label>Data Fattura</label>
                                                                                <input type="date" value={st.invoiceDate || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { invoiceDate: e.target.value })} />
                                                                            </div>
                                                                            <div className="form-group">
                                                                                <label>Data Pagamento</label>
                                                                                <input type="date" value={st.paymentDate || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { paymentDate: e.target.value })} />
                                                                            </div>
                                                                            <div className="form-group">
                                                                                <label>Modalità Pagamento</label>
                                                                                 <select value={st.paymentMethod || 'Bonifico'} onChange={e => handleUpdateSubTask(job.id, st.id, { paymentMethod: e.target.value as SubTask['paymentMethod'] })}>
                                                                                    <option>Bonifico</option>
                                                                                    <option>Banca</option>
                                                                                    <option>Assegno</option>
                                                                                    <option>Contanti</option>
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="sub-task-form">
                                                                            <div className="form-group">
                                                                                <label>Esecutore</label>
                                                                                <select value={st.executorId || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { executorId: e.target.value })}>
                                                                                    <option value="">Non assegnato</option>
                                                                                    {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                                </select>
                                                                            </div>
                                                                             <div className="form-group">
                                                                                <label>Data Inizio</label>
                                                                                <input type="date" value={st.startDate || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { startDate: e.target.value })} />
                                                                            </div>
                                                                            <div className="form-group">
                                                                                <label>Data Fine</label>
                                                                                <input type="date" value={st.endDate || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { endDate: e.target.value })} />
                                                                            </div>
                                                                            <div className="form-group" style={{gridColumn: 'span 2'}}>
                                                                                 <label>Note</label>
                                                                                <input type="text" value={st.notes || ''} onChange={e => handleUpdateSubTask(job.id, st.id, { notes: e.target.value })} />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface CustomersViewProps {
    customers: Customer[];
    jobs: Job[];
    services: Service[];
    onSave: (customer: Customer) => void;
    onDelete: (id: string) => void;
    onSelectJob: (jobId: string) => void;
}

const CustomersView: React.FC<CustomersViewProps> = ({ customers, jobs, services, onSave, onDelete, onSelectJob }) => {
    const [modalCustomer, setModalCustomer] = useState<Customer | undefined>(undefined);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    const handleEdit = (customer: Customer) => {
        setModalCustomer(customer);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setModalCustomer(undefined);
        setIsModalOpen(true);
    };

    const handleSave = (customer: Customer) => {
        onSave(customer);
        setIsModalOpen(false);
        if(selectedCustomer?.id === customer.id) {
            setSelectedCustomer(customer);
        }
    };

    if (selectedCustomer) {
        const customerJobs = jobs.filter(job => job.customerId === selectedCustomer.id);
        const openJobs = customerJobs.filter(j => !j.archived);
        const closedJobs = customerJobs.filter(j => j.archived);
        const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'N/A';

        const billingHistory = customerJobs
            .map(job => ({ job, billingSubTask: job.subTasks.find(st => st.name === 'Fatturazione')}))
            .filter(item => item.billingSubTask && item.billingSubTask.invoiceNumber)
            .map(item => ({
                serviceName: getServiceName(item.job.serviceId),
                invoiceNumber: item.billingSubTask!.invoiceNumber,
                invoiceDate: item.billingSubTask!.invoiceDate,
                paymentDate: item.billingSubTask!.paymentDate,
                paymentMethod: item.billingSubTask!.paymentMethod,
                status: item.billingSubTask!.paymentDate ? 'Pagata' : 'Da Pagare'
            }));


        return (
            <div className="customer-detail-view">
                 <div className="header">
                    <h2>Dettaglio Cliente</h2>
                    <button className="btn btn-secondary" onClick={() => setSelectedCustomer(null)}>Torna alla Lista</button>
                </div>
                <div className="customer-info-grid">
                     <div className="customer-info-item"><strong>Ragione Sociale</strong><span>{selectedCustomer.companyName}</span></div>
                     <div className="customer-info-item"><strong>Indirizzo</strong><span>{selectedCustomer.address}</span></div>
                     <div className="customer-info-item"><strong>P. IVA / CF</strong><span>{selectedCustomer.vatNumber}</span></div>
                     <div className="customer-info-item"><strong>Email</strong><span>{selectedCustomer.email}</span></div>
                     <div className="customer-info-item"><strong>PEC</strong><span>{selectedCustomer.pec}</span></div>
                </div>
                <div className="customer-jobs-section">
                    <h3>Lavori in Corso</h3>
                     {openJobs.length > 0 ? (
                        <ul>{openJobs.map(j => <li key={j.id} className="job-list-item" onClick={() => onSelectJob(j.id)}>{getServiceName(j.serviceId)} - Inizio: {formatDate(j.startDate)}</li>)}</ul>
                    ) : <p>Nessun lavoro in corso.</p>}
                </div>
                 <div className="customer-jobs-section">
                    <h3>Lavori Chiusi</h3>
                     {closedJobs.length > 0 ? (
                        <ul>{closedJobs.map(j => <li key={j.id} className="job-list-item" onClick={() => onSelectJob(j.id)}>{getServiceName(j.serviceId)} - Chiusura: {formatDate(j.closingDate)}</li>)}</ul>
                    ) : <p>Nessun lavoro chiuso.</p>}
                </div>
                <div className="customer-jobs-section">
                    <h3>Storico Fatturazione</h3>
                     {billingHistory.length > 0 ? (
                        <table>
                            <thead><tr><th>Servizio</th><th>Nr. Fattura</th><th>Data Fattura</th><th>Data Pagamento</th><th>Metodo</th><th>Stato</th></tr></thead>
                            <tbody>
                                {billingHistory.map((item, index) => (
                                    <tr key={index}>
                                        <td>{item.serviceName}</td>
                                        <td>{item.invoiceNumber}</td>
                                        <td>{formatDate(item.invoiceDate!)}</td>
                                        <td>{item.paymentDate ? formatDate(item.paymentDate) : '-'}</td>
                                        <td>{item.paymentMethod}</td>
                                        <td>
                                            <span className={`status-badge ${item.status === 'Pagata' ? 'paid' : 'unpaid'}`}>{item.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p>Nessuna fattura nello storico.</p>}
                </div>
            </div>
        );
    }
    

    return (
        <div>
            <div className="header">
                <h1>Clienti</h1>
                <button className="btn btn-primary" onClick={handleAddNew}>+ Aggiungi Cliente</button>
            </div>
            <table>
                <thead>
                    <tr><th>Ragione Sociale</th><th>Email</th><th>P. IVA</th><th style={{width: '100px'}}></th></tr>
                </thead>
                <tbody>
                    {customers.map(c => (
                        <tr key={c.id}>
                            <td onClick={() => setSelectedCustomer(c)} style={{cursor: 'pointer'}}>{c.companyName}</td>
                            <td>{c.email}</td>
                            <td>{c.vatNumber}</td>
                            <td className="actions">
                                <button onClick={() => handleEdit(c)} title="Modifica">✏️</button>
                                <button className="delete" onClick={() => onDelete(c.id)} title="Elimina">🗑️</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {isModalOpen && <CustomerFormModal customer={modalCustomer} onSave={handleSave} onClose={() => setIsModalOpen(false)} />}
        </div>
    );
};

interface BillingViewProps {
    jobs: Job[];
    customers: Customer[];
    services: Service[];
    setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
}

const BillingView: React.FC<BillingViewProps> = ({ jobs, customers, services, setJobs }) => {
    const invoicesToDo = useMemo(() => {
        return jobs.flatMap(job => 
            job.subTasks
                .filter(st => st.name === 'Fatturazione' && st.doInvoice && (!st.invoiceNumber || !st.invoiceDate))
                .map(st => ({ job, subTask: st }))
        );
    }, [jobs]);

    const invoiceHistory = useMemo(() => {
         return jobs.flatMap(job => 
            job.subTasks
                .filter(st => st.name === 'Fatturazione' && st.invoiceNumber && st.invoiceDate)
                .map(st => ({ job, subTask: st }))
        );
    }, [jobs]);
    
    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.companyName || 'N/A';
    const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'N/A';

    const handleUpdateBilling = (jobId: string, subTaskId: string, updatedFields: Partial<SubTask>) => {
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.id === jobId) {
                return {
                    ...job,
                    subTasks: job.subTasks.map(st => 
                        st.id === subTaskId ? { ...st, ...updatedFields } : st
                    )
                };
            }
            return job;
        }));
    };

    return (
        <div>
            <div className="header"><h1>Fatturazione</h1></div>
            <div className="invoices-todo-section">
                <h2>Fatture da Emettere</h2>
                {invoicesToDo.length === 0 ? <p>Nessuna fattura da emettere.</p> : (
                    invoicesToDo.map(({job, subTask}) => (
                        <div key={job.id} className="invoice-todo-item">
                            <div className="invoice-todo-header">
                                <span>{getCustomerName(job.customerId)}</span>
                                <span>{getServiceName(job.serviceId)}</span>
                            </div>
                             <p><strong>Note:</strong> {subTask.invoiceNotes || 'Nessuna nota.'}</p>
                            <div className="sub-task-billing-grid">
                                <div className="form-group">
                                    <label>Numero Fattura</label>
                                    <input type="text" value={subTask.invoiceNumber || ''} onChange={e => handleUpdateBilling(job.id, subTask.id, { invoiceNumber: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Data Fattura</label>
                                    <input type="date" value={subTask.invoiceDate || ''} onChange={e => handleUpdateBilling(job.id, subTask.id, { invoiceDate: e.target.value })} />
                                </div>
                                 <div className="form-group">
                                    <label>Data Pagamento</label>
                                    <input type="date" value={subTask.paymentDate || ''} onChange={e => handleUpdateBilling(job.id, subTask.id, { paymentDate: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Modalità Pagamento</label>
                                     <select value={subTask.paymentMethod || 'Bonifico'} onChange={e => handleUpdateBilling(job.id, subTask.id, { paymentMethod: e.target.value as SubTask['paymentMethod'] })}>
                                        <option>Bonifico</option>
                                        <option>Banca</option>
                                        <option>Assegno</option>
                                        <option>Contanti</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div>
                <h2>Storico Fatture</h2>
                <table>
                     <thead><tr><th>Cliente</th><th>Servizio</th><th>Nr. Fattura</th><th>Data Fattura</th><th>Stato</th></tr></thead>
                    <tbody>
                         {invoiceHistory.length === 0 ? <tr><td colSpan={5} style={{textAlign: 'center'}}>Nessuna fattura nello storico.</td></tr> : (
                            invoiceHistory.map(({job, subTask}) => (
                                <tr key={job.id}>
                                    <td>{getCustomerName(job.customerId)}</td>
                                    <td>{getServiceName(job.serviceId)}</td>
                                    <td>{subTask.invoiceNumber}</td>
                                    <td>{formatDate(subTask.invoiceDate!)}</td>
                                     <td>
                                        <span className={`status-badge ${subTask.paymentDate ? 'paid' : 'unpaid'}`}>{subTask.paymentDate ? 'Pagata' : 'Da Pagare'}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


interface SettingsViewProps {
    services: Service[];
    staff: Staff[];
    jobs: Job[];
    setServices: React.Dispatch<React.SetStateAction<Service[]>>;
    setStaff: React.Dispatch<React.SetStateAction<Staff[]>>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ services, staff, jobs, setServices, setStaff }) => {
    const [modal, setModal] = useState<ModalType>(null);
    
    const onSaveService = (service: Service) => {
        setServices(prev => {
            const index = prev.findIndex(s => s.id === service.id);
            if (index > -1) {
                const newServices = [...prev];
                newServices[index] = service;
                return newServices;
            }
            return [...prev, service];
        });
        setModal(null);
    };

    const onDeleteService = (id: string) => {
        if(jobs.some(job => job.serviceId === id)) {
            alert('Impossibile eliminare il servizio perchè è associato a uno o più lavori.');
            return;
        }
        if (window.confirm('Sei sicuro di voler eliminare questo servizio?')) {
            setServices(prev => prev.filter(s => s.id !== id));
        }
    };
    
    const onSaveStaff = (staffMember: Staff) => {
        setStaff(prev => {
            const index = prev.findIndex(s => s.id === staffMember.id);
            if (index > -1) {
                const newStaff = [...prev];
                newStaff[index] = staffMember;
                return newStaff;
            }
            return [...prev, staffMember];
        });
        setModal(null);
    };

    const onDeleteStaff = (id: string) => {
         if(jobs.some(job => job.responsibleId === id || job.subTasks.some(st => st.executorId === id))) {
            alert('Impossibile eliminare la persona perchè associata a uno o più lavori.');
            return;
        }
        if (window.confirm('Sei sicuro di voler eliminare questa persona?')) {
            setStaff(prev => prev.filter(s => s.id !== id));
        }
    };

    return (
        <div>
             <div className="header"><h1>Impostazioni</h1></div>
             <div className="settings-section">
                <div className="settings-header">
                    <h2>Tipi di Servizio</h2>
                    <button className="btn btn-primary" onClick={() => setModal({ type: 'service' })}>+ Aggiungi Servizio</button>
                </div>
                <table>
                    <thead><tr><th>Nome</th><th>Sotto-Lavorazioni</th><th style={{width: '100px'}}></th></tr></thead>
                    <tbody>
                        {services.map(s => (
                            <tr key={s.id}>
                                <td>{s.name}</td>
                                <td>
                                    <ul className="sub-tasks-list">
                                        {(s.subTasks ?? []).map((st, i) => <li key={i}>{st}</li>)}
                                    </ul>
                                </td>
                                <td className="actions">
                                    <button onClick={() => setModal({ type: 'service', service: s })} title="Modifica">✏️</button>
                                    <button className="delete" onClick={() => onDeleteService(s.id)} title="Elimina">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             <div className="settings-section">
                <div className="settings-header">
                    <h2>Personale</h2>
                     <button className="btn btn-primary" onClick={() => setModal({ type: 'staff' })}>+ Aggiungi Persona</button>
                </div>
                 <table>
                    <thead><tr><th>Nome</th><th style={{width: '100px'}}></th></tr></thead>
                    <tbody>
                        {staff.map(s => (
                            <tr key={s.id}>
                                <td>{s.name}</td>
                                <td className="actions">
                                    <button onClick={() => setModal({ type: 'staff', staff: s })} title="Modifica">✏️</button>
                                    <button className="delete" onClick={() => onDeleteStaff(s.id)} title="Elimina">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
            
            {modal?.type === 'service' && <ServiceFormModal service={modal.service} onSave={onSaveService} onClose={() => setModal(null)} />}
            {modal?.type === 'staff' && <StaffFormModal staffMember={modal.staff} onSave={onSaveStaff} onClose={() => setModal(null)} />}
        </div>
    );
};


// --- MAIN APP --- //

const App: React.FC = () => {
    const [jobs, setJobs] = useLocalStorage<Job[]>('jobs', []);
    const [customers, setCustomers] = useLocalStorage<Customer[]>('customers', []);
    const [services, setServices] = useLocalStorage<Service[]>('services', []);
    const [staff, setStaff] = useLocalStorage<Staff[]>('staff', []);
    
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [modal, setModal] = useState<ModalType>(null);
    const [initialExpandedJobId, setInitialExpandedJobId] = useState<string | null>(null);

    const handleSaveJob = (job: Job) => {
        setJobs(prev => {
            const index = prev.findIndex(j => j.id === job.id);
            if (index > -1) {
                const newJobs = [...prev];
                newJobs[index] = job;
                return newJobs;
            }
            return [...prev, job];
        });
        setModal(null);
    };

    const handleSaveCustomer = (customer: Customer) => {
        setCustomers(prev => {
            const index = prev.findIndex(c => c.id === customer.id);
            if (index > -1) {
                const newCustomers = [...prev];
                newCustomers[index] = customer;
                return newCustomers;
            }
            return [...prev, customer];
        });
    };

    const handleDeleteCustomer = (id: string) => {
        if (jobs.some(job => job.customerId === id)) {
            alert('Impossibile eliminare il cliente perchè è associato a uno o più lavori.');
            return;
        }
        if (window.confirm('Sei sicuro di voler eliminare questo cliente?')) {
            setCustomers(prev => prev.filter(c => c.id !== id));
        }
    };

    const viewJobDetails = (jobId: string) => {
        setInitialExpandedJobId(jobId);
        setActiveTab('jobs');
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'dashboard':
                 return <DashboardView
                            jobs={jobs}
                            customers={customers}
                            services={services}
                            onSelectJob={viewJobDetails}
                            onSelectTab={setActiveTab}
                        />;
            case 'jobs':
                return <JobsView 
                            jobs={jobs} 
                            customers={customers} 
                            services={services} 
                            staff={staff}
                            setJobs={setJobs}
                            onEdit={(job) => setModal({ type: 'job', job: job.id ? job : undefined })}
                            initialExpandedJobId={initialExpandedJobId}
                            setInitialExpandedJobId={setInitialExpandedJobId}
                        />;
            case 'customers':
                return <CustomersView
                            customers={customers}
                            jobs={jobs}
                            services={services}
                            onSave={handleSaveCustomer}
                            onDelete={handleDeleteCustomer}
                            onSelectJob={viewJobDetails}
                        />;
            case 'billing':
                return <BillingView jobs={jobs} customers={customers} services={services} setJobs={setJobs} />;
            case 'settings':
                return <SettingsView services={services} staff={staff} jobs={jobs} setServices={setServices} setStaff={setStaff} />;
            default:
                return null;
        }
    };

    return (
        <div className="app-container">
            <div className="tabs">
                <button className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                <button className={`tab ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>Lavori</button>
                <button className={`tab ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => setActiveTab('customers')}>Clienti</button>
                <button className={`tab ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => setActiveTab('billing')}>Fatturazione</button>
                <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>Impostazioni</button>
            </div>
            <div className="tab-content">
                {renderTabContent()}
            </div>
            {modal?.type === 'job' && <JobFormModal job={modal.job} customers={customers} services={services} staff={staff} onSave={handleSaveJob} onClose={() => setModal(null)} />}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);
