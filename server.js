const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
const {ObjectId} = require('mongodb');

// middleware 요청과 응답 사이에 동작하는 코드
app.use('/public', express.static('public'));

// .env 파일에서 가져온 변수 사용하기 위한 설정
require('dotenv').config()
var db;
MongoClient.connect(process.env.DB_URL, {useUnifiedTopology: true}, function(error, client){
    if(error) return console.log(error);

    // database 연결하기
    db = client.db('todoapp');

    app.listen(process.env.PORT, function(){
        console.log('listening on 8080');
    });
})

// Login 기능
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(session({secret: '비밀코드', resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

// login, 회원가입 페이지
app.get('/login', function(req, res){
    res.render('login.ejs');
})

// login 기능
app.post('/login', passport.authenticate('local', {
    failureRedirect: '/fail'
}), function(req, res){
    res.redirect('/')
});

// 회원가입 기능
app.post('/register', function(req, res){
    db.collection('login').insertOne({id: req.body.id, pw: req.body.pw}, function(error, result){
        res.redirect('/');
    })
})

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


// 메인 홈페이지
app.get('/', function(req, res){
    res.render('index.ejs', {user: req.user});
})

// write 페이지
app.get('/write', function(req, res){
    // res.sendFile(__dirname + '/write.html');
    res.render('write.ejs');
})

// list 페이지
app.get('/list', function(req, res){
    db.collection('post').find().toArray(function(error, result){
        // console.log(result);
        res.render('list.ejs', {posts: result});
    });
})

app.get('/search', function(req, res){
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

// detail 페이지
app.get('/detail/:id', function(req, res){
    db.collection('post').findOne({_id: parseInt(req.params.id)}, function(error, result){
        res.render('detail.ejs', {data:result});
    })
})

// edit 페이지
app.get('/edit/:id', function(req, res){
    db.collection('post').findOne({_id: parseInt(req.params.id)}, function(error, result){
        res.render('edit.ejs', {data: result});
    })
})

// edit 페이지 내 수정기능능
app.put('/edit', function(req, res){
    db.collection('post').updateOne({_id: parseInt(req.body.id)}, {$set: {제목: req.body.title, 날짜: req.body.date}}, function(error, result){
        console.log('수정완료');
        res.redirect('/list');
    })
});


// login 확인 기능
function logincheck(req, res, next){
    if(req.user){
        next()
    } else{
        res.send('Login failed');
    }
}

// 게시물 발행
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

// 게시물 삭제
app.delete('/delete', function(req, res){
    req.body._id = parseInt(req.body._id);    
    db.collection('post').deleteOne(req.body, function(error, result){
        console.log('삭제완료');
        res.status(200).send({message: '성공했습니다'});
    })
})

//middleware
app.use('/shop', require('./routes/shop.js'));


let multer = require('multer');
// var storage = multer.memoryStorage({}); RAM에다가 휘발성 있게 저장하기
var storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, './public/image');
    },
    filename: function(req, file, cb){
        cb(null, file.originalname + new Date())
    },
    filefilter: function(req,file, cb){

    }
})

var upload = multer({storage: storage});

// Image 업로드 페이지
app.get('/upload', function(req, res){
    res.render('upload.ejs');
})

// 업로드 기능
app.post('/upload', upload.single('profile'), function(req, res){
    res.send('업로드완료');
})

// 이미지 조회 페이지
app.get('/image/:imageName', function(req, res){
    res.sendFile(__dirname + '/public/image/' + req.params.imageName);
})


// 채팅방 생성 기능
app.post('/chatroom', function(req, res){
    var save = {
        title: '무슨채팅방',
        member: [ObjectId(req.body.당한사람id), req.user._id],
        date: new Date()
    }
    db.collection('chatroom').insertOne(save).then(function(error, result){
        res.send('성공');
    })
})

// chat 페이지
app.get('/chat', logincheck, function(요청, 응답){
    db.collection('chatroom').find({ member : 요청.user._id }).toArray().then((결과)=>{
      console.log(결과);
      응답.render('chat.ejs', {data : 결과})
    })
});

// 메시지 보내기 기능
app.post('/message/:id', logincheck, function(req, res){
    var 저장할거 = {
        parent: req.body.parent,
        content: req.body.content,
        userid: req.user._id,
        date: new Date()
    }
    db.collection('message').insertOne({}).then(()=>{
        console.log('DB저장성공');
        res.send('DB저장성공');
    })
})