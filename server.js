const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
app.use(methodOverride('_method'));

app.set('view engine', 'ejs');

// middleware 요청과 응답 사이에 동작하는 코드
app.use('/public', express.static('public'));

require('dotenv').config()


var db;

MongoClient.connect(process.env.DB_URL, function(error, client){
    if(error) return console.log(error);

    // database 연결하기
    db = client.db('todoapp');

    app.listen(process.env.PORT, function(){
        console.log('listening on 8080');
    });
})

app.get('/pet', function(req, res){
    res.send('펫 용품 쇼핑을 할 수 있는 사이트입니다');
})

app.get('/beauty', function(req, res){
    // console.log(req);
    res.send('뷰티 용품 쇼핑 가능 사이트임');
})

app.get('/', function(req, res){
    res.render('index.ejs');
})

app.get('/write', function(req, res){
    // res.sendFile(__dirname + '/write.html');
    res.render('write.ejs');
})

app.get('/list', function(req, res){
    db.collection('post').find().toArray(function(error, result){
        // console.log(result);
        res.render('list.ejs', {posts: result});
    });
})

app.get('/search', function(req, res){
    console.log(req.query.value);
    var search_condition = [
        {
            $search: {
                index: 'titleSearch',
                text:{
                    query: req.query.value,
                    path: "제목"
                }
            }
        },
        // {$sort: {_id: 1}},
        // {$limit: 10},
        // {$project: {제목: 1, _id: 1, score: {$meta: 'searchScore'}}}
    ]
    db.collection('post').aggregate(search_condition).toArray(function(error, result){
        res.render('search.ejs', {posts: result})
    })
})

app.get('/detail/:id', function(req, res){
    db.collection('post').findOne({_id: parseInt(req.params.id)}, function(error, result){
        res.render('detail.ejs', {data:result});
    })
})

app.get('/edit/:id', function(req, res){
    db.collection('post').findOne({_id: parseInt(req.params.id)}, function(error, result){
        res.render('edit.ejs', {data: result});
    })
})

app.put('/edit', function(req, res){
    db.collection('post').updateOne({_id: parseInt(req.body.id)}, {$set: {제목: req.body.title, 날짜: req.body.date}}, function(error, result){
        console.log('수정완료');
        res.redirect('/list');
    })
});


const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({secret: '비밀코드', resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', function(req, res){
    res.render('login.ejs');
})

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/fail'
}), function(req, res){
    res.redirect('/')
});


app.get('/mypage', logincheck, function(req, res){
    console.log(req.user);
    res.render('mypage.ejs', {user : req.user});
})

function logincheck(req, res, next){
    if(req.user){
        next()
    } else{
        res.send('Login failed');
    }
}


passport.use(new LocalStrategy({
    usernameField: 'id',
    passwordField: 'pw',
    session: true,
    passReqToCallback: false,    
}, function(입력한아이디, 입력한비번, done){
    console.log(입력한아이디, 입력한비번);
    db.collection('login').findOne({id: 입력한아이디}, function(error, result){
        if(error) return done(error);
        if(!result) return done(null, false, {message: '존재하지 않는 아이디요'})
        if(입력한비번 == result.pw){
            return done(null, result)
        } else {
            return done(null, false, {message: '비번틀렸어요'})
        }
    })
}));

// done(서버에러, 성공시 사용자 DB데이터, 에러메시지)
passport.serializeUser(function(user, done){
    done(null, user.id);
})

// 로그인한 유저의 세션아이디를 바탕으로 개인정보를 DB에서 찾는 역할
passport.deserializeUser(function(id, done){
    db.collection('login').findOne({id: id}, function(error, result){
        done(null, result);
    })
});


app.post('/register', function(req, res){
    db.collection('login').insertOne({id: req.body.id, pw: req.body.pw}, function(error, result){
        res.redirect('/');
    })
})

app.post('/add', (req, res) => {
    res.send('전송완료');
    db.collection('counter').findOne({name: '게시물갯수'}, function(error, result){
        console.log(result.totalPost);

        var temp = {_id: result.totalPost + 1, 작성자: req.user._id, 제목: req.body.title, 날짜: req.body.date};
        db.collection('post').insertOne(temp, function(error, result){
            console.log('저장 완료');
            db.collection('counter').updateOne({name: '게시물갯수'}, {$inc : {totalPost: 1}}, function(error, result){
                if(error) return console.log(error);
            })
        })
    });
})

app.delete('/delete', function(req, res){
    console.log(req.body);
    req.body._id = parseInt(req.body._id);
    
    var delete_item = {_id: req.body._id, 작성자: req.user._id}
    
    db.collection('post').deleteOne(delete_item, function(error, result){
        console.log('삭제완료');
        res.status(200).send({message: '성공했습니다'});
    })
})

//middleware
app.use('/shop', require('./routes/shop.js'));

