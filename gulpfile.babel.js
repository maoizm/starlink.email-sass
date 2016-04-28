import gulp     from 'gulp';
import plugins  from 'gulp-load-plugins';
import browser  from 'browser-sync';
import rimraf   from 'rimraf';
import panini   from 'panini';
import yargs    from 'yargs';
import lazypipe from 'lazypipe';
import inky     from 'inky';
import fs       from 'fs';
import siphon   from 'siphon-media-query';
import he       from 'he';

const $ = plugins();

// Look for the --production flag
const PRODUCTION = !!(yargs.argv.production);

// mao: Decode all HTML entities using he module
function am_decode(content) {
    return he.decode(content);
}

//gulp.task('decode', function () {
//    return gulp.src('dist/**/*.html')
//        .pipe($.change(am_decode))
//        .pipe(gulp.dest('dist'));
//});

// mao: Decode all HTML entities using 'he' module
//      and am_decode() function
function decode() {
    return gulp.src('dist/**/*.html')
        .pipe($.change(am_decode))
        .pipe(gulp.dest('dist'));
}

// Build the "dist" folder by running all of the above tasks
gulp.task('build',
    gulp.series(clean, pages, decode, sass, images, inline));

// Build emails, run the server, and watch for file changes
gulp.task('default',
    gulp.series('build', server, watch));

// Delete the "dist" folder
// This happens every time a build starts
function clean(done) {
    rimraf('dist', done);
}

// Compile layouts, pages, and partials into flat HTML files
// Then parse using Inky templates
function pages() {
    return gulp.src('src/pages/**/*.html')
        .pipe(panini({
            root: 'src/pages',
            layouts: 'src/layouts',
            partials: 'src/partials'
        }))
        .pipe(inky({cheerio: {decodeEntities: true}}))
        .pipe(gulp.dest('dist'));
}

// Reset Panini's cache of layouts and partials
function resetPages(done) {
    panini.refresh();
    done();
}

// Compile Sass into CSS
function sass() {
    return gulp.src('src/assets/scss/app.scss')
        .pipe($.if(!PRODUCTION, $.sourcemaps.init()))
        .pipe($.sass({
            includePaths: ['node_modules/foundation-emails/scss']
        }).on('error', $.sass.logError))
        .pipe($.if(!PRODUCTION, $.sourcemaps.write()))
        .pipe(gulp.dest('dist/css'));
}

// Copy and compress images
function images() {
    return gulp.src('src/assets/img/**/*.*')
        .pipe($.imagemin())
        .pipe(gulp.dest('./dist/assets/img'));
}

// Inline CSS and minify HTML
function inline() {
    return gulp.src('dist/**/*.html')
        .pipe($.if(PRODUCTION, inliner('dist/css/app.css')))
        .pipe(gulp.dest('dist'));
}

// Start a server with LiveReload to preview the site in
function server(done) {
    browser.init({
        server: {
            baseDir: 'dist',
            index: "20160428_letter_phplist.html"
        }
    });
    done();
}

// Watch for file changes
function watch() {
    gulp.watch('src/pages/**/*.html', gulp.series(pages, 'decode', inline, browser.reload));
    gulp.watch(['src/layouts/**/*', 'src/partials/**/*'], gulp.series(resetPages, pages, 'decode', inline, browser.reload));
    gulp.watch(['../scss/**/*.scss', 'src/assets/scss/**/*.scss'], gulp.series(sass, pages, 'decode', inline, browser.reload));
    gulp.watch('src/img/**/*', gulp.series(images, browser.reload));
}

// Inlines CSS into HTML, adds media query CSS into the <style> tag of the email, and compresses the HTML
function inliner(css) {
    var css = fs.readFileSync(css).toString();
    var mqCss = siphon(css);
    var pipe = lazypipe()
        .pipe($.inlineCss, { applyStyleTags: false })
        .pipe($.injectString.replace, '<!-- <style> -->', `<style>${mqCss}</style>`)
        .pipe($.htmlin, { collapseWhitespace: true, minifyCSS: true }
    );
    return pipe();
}
