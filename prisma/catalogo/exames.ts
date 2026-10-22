import type { ExameColetado } from "../../src/lib/catalogo/schemas";

/**
 * Primeiros exames do catálogo, lidos das fontes oficiais em 2026-10-22:
 * - exam guide (docs.aws.amazon.com): questões pontuadas e não pontuadas, nota de corte, domínios, pesos e task statements;
 * - página da certificação (aws.amazon.com): nível, duração, total de questões e preço.
 * Nenhuma das fontes anuncia data de lançamento ou de aposentadoria desta versão (só de idiomas), então ficam nulas.
 * Os nomes em inglês são os oficiais; nomePt é tradução nossa. A pipeline mensal (etapa 3b) confere e versiona.
 */
export const EXAMES_INICIAIS: ExameColetado[] = [
  {
    certificacao: { slug: "cloud-practitioner", nome: "AWS Certified Cloud Practitioner", nivel: "FOUNDATIONAL", ordemTrilha: 1 },
    codigo: "CLF-C02",
    status: "ACTIVE",
    totalQuestoes: 65,
    questoesPontuadas: 50,
    duracaoMin: 90,
    notaCorte: 700,
    precoUsd: 100,
    lancadoEm: null,
    aposentaEm: null,
    fonteGuia: "https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html",
    fontePagina: "https://aws.amazon.com/certification/certified-cloud-practitioner/",
    lidoEm: "2026-10-22",
    dominios: [
      {
        codigo: "1",
        nomeEn: "Cloud Concepts",
        nomePt: "Conceitos de nuvem",
        peso: 24,
        tarefas: [
          { codigo: "1.1", nomeEn: "Define the benefits of the AWS Cloud.", nomePt: "Definir os benefícios da Nuvem AWS." },
          { codigo: "1.2", nomeEn: "Identify design principles of the AWS Cloud.", nomePt: "Identificar os princípios de design da Nuvem AWS." },
          {
            codigo: "1.3",
            nomeEn: "Understand the benefits of and strategies for migration to the AWS Cloud.",
            nomePt: "Entender os benefícios e as estratégias de migração para a Nuvem AWS.",
          },
          { codigo: "1.4", nomeEn: "Understand concepts of cloud economics.", nomePt: "Entender os conceitos de economia da nuvem." },
        ],
      },
      {
        codigo: "2",
        nomeEn: "Security and Compliance",
        nomePt: "Segurança e conformidade",
        peso: 30,
        tarefas: [
          { codigo: "2.1", nomeEn: "Understand the AWS shared responsibility model.", nomePt: "Entender o modelo de responsabilidade compartilhada da AWS." },
          {
            codigo: "2.2",
            nomeEn: "Understand AWS Cloud security, governance, and compliance concepts.",
            nomePt: "Entender os conceitos de segurança, governança e conformidade da Nuvem AWS.",
          },
          { codigo: "2.3", nomeEn: "Identify AWS access management capabilities.", nomePt: "Identificar os recursos de gerenciamento de acesso da AWS." },
          { codigo: "2.4", nomeEn: "Identify components and resources for security.", nomePt: "Identificar componentes e recursos de segurança." },
        ],
      },
      {
        codigo: "3",
        nomeEn: "Cloud Technology and Services",
        nomePt: "Tecnologia e serviços de nuvem",
        peso: 34,
        tarefas: [
          {
            codigo: "3.1",
            nomeEn: "Define methods of deploying and operating in the AWS Cloud.",
            nomePt: "Definir métodos de implantação e operação na Nuvem AWS.",
          },
          { codigo: "3.2", nomeEn: "Define the AWS global infrastructure.", nomePt: "Definir a infraestrutura global da AWS." },
          { codigo: "3.3", nomeEn: "Identify AWS compute services.", nomePt: "Identificar os serviços de computação da AWS." },
          { codigo: "3.4", nomeEn: "Identify AWS database services.", nomePt: "Identificar os serviços de banco de dados da AWS." },
          { codigo: "3.5", nomeEn: "Identify AWS network services.", nomePt: "Identificar os serviços de rede da AWS." },
          { codigo: "3.6", nomeEn: "Identify AWS storage services.", nomePt: "Identificar os serviços de armazenamento da AWS." },
          {
            codigo: "3.7",
            nomeEn: "Identify AWS artificial intelligence and machine learning (AI/ML) services and analytics services.",
            nomePt: "Identificar os serviços de inteligência artificial e machine learning (IA/ML) e de análise de dados da AWS.",
          },
          {
            codigo: "3.8",
            nomeEn: "Identify services from other in-scope AWS service categories.",
            nomePt: "Identificar serviços de outras categorias da AWS no escopo do exame.",
          },
        ],
      },
      {
        codigo: "4",
        nomeEn: "Billing, Pricing, and Support",
        nomePt: "Faturamento, preços e suporte",
        peso: 12,
        tarefas: [
          { codigo: "4.1", nomeEn: "Compare AWS pricing models.", nomePt: "Comparar os modelos de preço da AWS." },
          {
            codigo: "4.2",
            nomeEn: "Understand resources for billing, budget, and cost management.",
            nomePt: "Entender os recursos de faturamento, orçamento e gestão de custos.",
          },
          {
            codigo: "4.3",
            nomeEn: "Identify AWS technical resources and AWS Support options.",
            nomePt: "Identificar os recursos técnicos e as opções de AWS Support.",
          },
        ],
      },
    ],
  },
  {
    certificacao: { slug: "ai-practitioner", nome: "AWS Certified AI Practitioner", nivel: "FOUNDATIONAL", ordemTrilha: 2 },
    codigo: "AIF-C01",
    status: "ACTIVE",
    totalQuestoes: 65,
    questoesPontuadas: 50,
    duracaoMin: 90,
    notaCorte: 700,
    precoUsd: 100,
    lancadoEm: null,
    aposentaEm: null,
    fonteGuia: "https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html",
    fontePagina: "https://aws.amazon.com/certification/certified-ai-practitioner/",
    lidoEm: "2026-10-22",
    dominios: [
      {
        codigo: "1",
        nomeEn: "Fundamentals of AI and ML",
        nomePt: "Fundamentos de IA e ML",
        peso: 20,
        tarefas: [
          { codigo: "1.1", nomeEn: "Explain basic AI concepts and terminologies.", nomePt: "Explicar conceitos e terminologia básicos de IA." },
          { codigo: "1.2", nomeEn: "Identify practical use cases for AI.", nomePt: "Identificar casos de uso práticos de IA." },
          { codigo: "1.3", nomeEn: "Describe the AI/ML development lifecycle.", nomePt: "Descrever o ciclo de desenvolvimento de IA/ML." },
        ],
      },
      {
        codigo: "2",
        nomeEn: "Fundamentals of GenAI",
        nomePt: "Fundamentos de IA generativa",
        peso: 24,
        tarefas: [
          {
            codigo: "2.1",
            nomeEn: "Explain the basic concepts of generative AI (GenAI).",
            nomePt: "Explicar os conceitos básicos de IA generativa.",
          },
          {
            codigo: "2.2",
            nomeEn: "Understand the capabilities and limitations of GenAI for solving business problems.",
            nomePt: "Entender as capacidades e as limitações da IA generativa para resolver problemas de negócio.",
          },
          {
            codigo: "2.3",
            nomeEn: "Describe AWS infrastructure and technologies for building GenAI applications.",
            nomePt: "Descrever a infraestrutura e as tecnologias da AWS para criar aplicações de IA generativa.",
          },
        ],
      },
      {
        codigo: "3",
        nomeEn: "Applications of Foundation Models",
        nomePt: "Aplicações de modelos de fundação",
        peso: 28,
        tarefas: [
          {
            codigo: "3.1",
            nomeEn: "Describe design considerations for applications that use foundation models (FMs).",
            nomePt: "Descrever as considerações de design de aplicações que usam modelos de fundação (FMs).",
          },
          { codigo: "3.2", nomeEn: "Choose effective prompt engineering techniques.", nomePt: "Escolher técnicas eficazes de engenharia de prompt." },
          { codigo: "3.3", nomeEn: "Describe the training and fine-tuning process for FMs.", nomePt: "Descrever o processo de treinamento e ajuste fino de FMs." },
          { codigo: "3.4", nomeEn: "Describe methods to evaluate FM performance.", nomePt: "Descrever métodos para avaliar o desempenho de FMs." },
        ],
      },
      {
        codigo: "4",
        nomeEn: "Guidelines for Responsible AI",
        nomePt: "Diretrizes de IA responsável",
        peso: 14,
        tarefas: [
          {
            codigo: "4.1",
            nomeEn: "Explain the development of AI systems that are responsible.",
            nomePt: "Explicar o desenvolvimento de sistemas de IA responsáveis.",
          },
          {
            codigo: "4.2",
            nomeEn: "Recognize the importance of transparent and explainable models.",
            nomePt: "Reconhecer a importância de modelos transparentes e explicáveis.",
          },
        ],
      },
      {
        codigo: "5",
        nomeEn: "Security, Compliance, and Governance for AI Solutions",
        nomePt: "Segurança, conformidade e governança de soluções de IA",
        peso: 14,
        tarefas: [
          { codigo: "5.1", nomeEn: "Explain methods to secure AI systems.", nomePt: "Explicar métodos para proteger sistemas de IA." },
          {
            codigo: "5.2",
            nomeEn: "Recognize governance and compliance regulations for AI systems.",
            nomePt: "Reconhecer normas de governança e conformidade para sistemas de IA.",
          },
        ],
      },
    ],
  },
  {
    certificacao: {
      slug: "solutions-architect-associate",
      nome: "AWS Certified Solutions Architect – Associate",
      nivel: "ASSOCIATE",
      ordemTrilha: 1,
    },
    codigo: "SAA-C03",
    status: "ACTIVE",
    totalQuestoes: 65,
    questoesPontuadas: 50,
    duracaoMin: 130,
    notaCorte: 720,
    precoUsd: 150,
    lancadoEm: null,
    aposentaEm: null,
    fonteGuia: "https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html",
    fontePagina: "https://aws.amazon.com/certification/certified-solutions-architect-associate/",
    lidoEm: "2026-10-22",
    dominios: [
      {
        codigo: "1",
        nomeEn: "Design Secure Architectures",
        nomePt: "Projetar arquiteturas seguras",
        peso: 30,
        tarefas: [
          { codigo: "1.1", nomeEn: "Design secure access to AWS resources", nomePt: "Projetar acesso seguro aos recursos da AWS" },
          { codigo: "1.2", nomeEn: "Design secure workloads and applications", nomePt: "Projetar cargas de trabalho e aplicações seguras" },
          { codigo: "1.3", nomeEn: "Determine appropriate data security controls", nomePt: "Definir controles adequados de segurança de dados" },
        ],
      },
      {
        codigo: "2",
        nomeEn: "Design Resilient Architectures",
        nomePt: "Projetar arquiteturas resilientes",
        peso: 26,
        tarefas: [
          {
            codigo: "2.1",
            nomeEn: "Design scalable and loosely coupled architectures",
            nomePt: "Projetar arquiteturas escaláveis e com baixo acoplamento",
          },
          {
            codigo: "2.2",
            nomeEn: "Design highly available and/or fault-tolerant architectures",
            nomePt: "Projetar arquiteturas de alta disponibilidade e/ou tolerantes a falhas",
          },
        ],
      },
      {
        codigo: "3",
        nomeEn: "Design High-Performing Architectures",
        nomePt: "Projetar arquiteturas de alto desempenho",
        peso: 24,
        tarefas: [
          {
            codigo: "3.1",
            nomeEn: "Determine high-performing and/or scalable storage solutions",
            nomePt: "Definir soluções de armazenamento de alto desempenho e/ou escaláveis",
          },
          {
            codigo: "3.2",
            nomeEn: "Design high-performing and elastic compute solutions",
            nomePt: "Projetar soluções de computação de alto desempenho e elásticas",
          },
          { codigo: "3.3", nomeEn: "Determine high-performing database solutions", nomePt: "Definir soluções de banco de dados de alto desempenho" },
          {
            codigo: "3.4",
            nomeEn: "Determine high-performing and/or scalable network architectures",
            nomePt: "Definir arquiteturas de rede de alto desempenho e/ou escaláveis",
          },
          {
            codigo: "3.5",
            nomeEn: "Determine high-performing data ingestion and transformation solutions",
            nomePt: "Definir soluções de ingestão e transformação de dados de alto desempenho",
          },
        ],
      },
      {
        codigo: "4",
        nomeEn: "Design Cost-Optimized Architectures",
        nomePt: "Projetar arquiteturas com custo otimizado",
        peso: 20,
        tarefas: [
          { codigo: "4.1", nomeEn: "Design cost-optimized storage solutions", nomePt: "Projetar soluções de armazenamento com custo otimizado" },
          { codigo: "4.2", nomeEn: "Design cost-optimized compute solutions", nomePt: "Projetar soluções de computação com custo otimizado" },
          { codigo: "4.3", nomeEn: "Design cost-optimized database solutions", nomePt: "Projetar soluções de banco de dados com custo otimizado" },
          { codigo: "4.4", nomeEn: "Design cost-optimized network architectures", nomePt: "Projetar arquiteturas de rede com custo otimizado" },
        ],
      },
    ],
  },
];
