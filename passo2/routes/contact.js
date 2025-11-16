var express = require('express');
var router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db');


/**
 * GET /contato – exibe o formulário.
 * Enviamos 'data' vazio e 'errors' vazio para facilitar o template.
 */
router.get('/', (req, res) => {
    res.render('contact', {
        title: 'Formulário de Contato',
        data: {},
        errors: {}
    });
});

router.get('/list', (req, res) => {
  const rows = db.prepare(`
    SELECT id, nome, email, idade, genero, interesses, mensagem, criado_em
    FROM contatos
    ORDER BY criado_em DESC
  `).all();

  res.render('list-contact', {
    title: 'Lista de Contatos',
    contatos: rows
  });
});


/**
 * POST /contato – valida, sanitiza e decide: erro -> reexibir formulário; sucesso -> página de sucesso
 */
router.post('/',
    // Validações e sanitizações
    [
        body('nome')
            .trim().isLength({ min: 3, max: 60 })
            .trim()
            .escape()
            .withMessage('Nome deve ter entre 3 e 60 caracteres.')
            .matches(/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/)
            .withMessage('Nome contém caracteres inválidos.')
            .escape(),
        body('email')
            .trim().isEmail().withMessage('E-mail inválido.')
            .normalizeEmail(),
        body('idade')
            .trim().optional({ checkFalsy: true })
            .isInt({ min: 1, max: 120 }).withMessage('Idade deve ser um inteiro entre 1 e 120.')
            .toInt(),
        body('genero')
            .isIn(['', 'feminino', 'masculino', 'nao-binario', 'prefiro-nao-informar'])
            .withMessage('Gênero inválido.'),
        body('interesses')
            .optional({ checkFalsy: true })
            .customSanitizer(v => Array.isArray(v) ? v : (v ? [v] : [])) // sempre array
            .custom((arr) => {
                const valid = ['node', 'express', 'ejs', 'frontend', 'backend'];
                return arr.every(x => valid.includes(x));
            }).withMessage('Interesse inválido.'),
        body('mensagem')
            .trim().isLength({ min: 10, max: 500 }).withMessage('Mensagem deve ter entre 10 e 500 caracteres.')
            .escape(),
        body('aceite')
            .equals('on').withMessage('Você deve aceitar os termos para continuar.'),
        body('nome')
            .matches(/^[\p{L} ' -]+$/u)
            .withMessage('Use apenas letras, espaços, apóstrofo e hífen.')
    ],
    (req, res) => {
        const errors = validationResult(req);

        // Para repovoar o formulário, mantemos os dados originais (com algumas sanitizações acima)
        const data = {
            nome: req.body.nome,
            email: req.body.email,
            idade: req.body.idade,
            genero: req.body.genero || '',
            interesses: req.body.interesses || [],
            mensagem: req.body.mensagem,
            aceite: req.body.aceite === 'on'
        };

        if (!errors.isEmpty()) {
            // Mapeamos erros por campo para facilitar no EJS
            const mapped = errors.mapped(); // { campo: { msg, param, ... } }
            return res.status(400).render('contact', {
                title: 'Formulário de Contato',
                data,
                errors: mapped
            });
        }

        // Aqui você poderia persistir no banco, enviar e-mail, etc.

        const stmt = db.prepare(`
            INSERT INTO contatos (nome, email, idade, genero, interesses, mensagem, aceite)
            VALUES (@nome, @email, @idade, @genero, @interesses, @mensagem, @aceite)
            `);
        stmt.run({
            nome: data.nome,
            email: data.email,
            idade: data.idade || null,
            genero: data.genero || null,
            interesses: Array.isArray(data.interesses)
                ? data.interesses.join(',')
                : (data.interesses || ''),
            mensagem: data.mensagem,
            aceite: data.aceite ? 1 : 0
        });
        return res.render('success', {
            title: 'Enviado com sucesso',
            data
        });


    }
);

module.exports = router;
